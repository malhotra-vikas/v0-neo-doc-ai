import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const start = Date.now()
    console.log("🔁 [process-nursing-home-files] Incoming request")

    try {
        const { filePath, month, year, usState } = await req.json()

        if (!filePath) {
            console.warn("⚠️ No filePath provided in request body")
            return NextResponse.json({ error: "Missing filePath" }, { status: 400 })
        }

        console.log(`📄 Request to process Excel file at: ${filePath}`)

        // Step 1: Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('nursing-home-files')
            .download(filePath)

        if (downloadError || !fileData) {
            console.error("❌ Failed to download file:", downloadError)
            return NextResponse.json({ error: "Download failed" }, { status: 500 })
        }

        console.log(`✅ Downloaded file (${fileData.size} bytes)`)

        const buffer = Buffer.from(await fileData.arrayBuffer())
        const workbook = XLSX.read(buffer, { type: 'buffer' })

        // Step 2: Extract unique SNF facilities
        const getFacilities = (sheetName: string): string[] => {
            const sheet = workbook.Sheets[sheetName]
            if (!sheet) {
                console.warn(`⚠️ Sheet not found: ${sheetName}`)
                return []
            }

            const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
            const names = data
                .map((row) => row['SNF Facility Name']?.toString().trim())
                .filter((name): name is string => Boolean(name))

            console.log(`📄 Found ${names.length} entries in "${sheetName}"`)
            return names
        }

        const facilitiesSet = new Set([
            ...getFacilities('CCM Master'),
            ...getFacilities('CCM Master Discharged'),
            ...getFacilities('PMR - Non CCM'),
        ])

        const uniqueFacilities = Array.from(facilitiesSet)
        console.log(`🧼 Deduplicated to ${uniqueFacilities.length} unique SNF facilities`)

        // Step 3: Fetch existing names
        const { data: existing, error: fetchError } = await supabase
            .from('nursing_homes')
            .select('id, name')

        if (fetchError) {
            console.error("❌ Failed to fetch existing nursing homes:", fetchError)
            return NextResponse.json({ error: "Database read error" }, { status: 500 })
        }

        const normalize = (name: string) => name.trim().toLowerCase()
        const existingNames = new Set((existing ?? []).map((e) => normalize(e.name)))

        const toInsert = uniqueFacilities
            .filter((name) => !existingNames.has(normalize(name)))
            .map((name) => ({
                name: name.trim(),
                us_state: usState,
                facility_id: "6a6ed56c-4ff9-4c36-8126-b56685cc9721", // Puzzle's Facility ID
            })) // insert with clean display name

        console.log(`📥 Preparing to insert ${toInsert.length} new nursing homes`)
        console.log("🧾 Facilities to insert:", toInsert.map(f => f.name))

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase.from('nursing_homes').insert(toInsert)

            if (insertError) {
                console.error("❌ Insert error:", insertError)
                return NextResponse.json({ error: "Insert failed", detail: insertError.message }, { status: 500 })
            }

            console.log(`✅ Inserted ${toInsert.length} new facilities`)
        } else {
            console.log("ℹ️ No new facilities to insert")
        }

        // Re-fetch all homes for ID mapping
        const { data: homes } = await supabase
            .from('nursing_homes')
            .select('id, name')

        const nameToId = new Map(homes.map(h => [normalize(h.name), h.id]))

        // Count patients by facility from each sheet
        const sheetNames = ['CCM Master', 'CCM Master Discharged', 'PMR - Non CCM']
        const sheetWiseCounts: Record<string, Record<string, number>> = {}

        const facilityPatientSummary: Record<
            string,
            {
                facilityName: string
                ccmMasterCount: number
                ccmMasterDischargedCount: number
                nonCcmMasterCount: number
                h30Admit: number
                //h30Discharge: number
                //h60: number
                //h90: number
                //hReported: number
            }
        > = {}

        for (const sheetName of sheetNames) {
            const sheet = workbook.Sheets[sheetName]
            if (!sheet) continue

            const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

            for (const row of data) {
                const raw = row['SNF Facility Name']
                const name = raw?.toString().trim()
                if (!name) continue

                const key = normalize(name)

                if (!facilityPatientSummary[key]) {
                    facilityPatientSummary[key] = {
                        facilityName: key,
                        ccmMasterCount: 0,
                        ccmMasterDischargedCount: 0,
                        nonCcmMasterCount: 0,
                        h30Admit: 0,
                        //h30Discharge: 0,
                        //h60: 0,
                        //h90: 0,
                        //hReported: 0
                    }
                }

                const summary = facilityPatientSummary[key]

                if (sheetName === 'CCM Master') {
                    if (row['SNF Facility Name'] === raw) {

                        summary.ccmMasterCount += 1
                        if (row['30 Day Reported Hospitalization - from SNF Admit Date']) summary.h30Admit += 1

                    }
                }

                if (sheetName === 'CCM Master Discharged') {
                    if (row['SNF Facility Name'] === raw) {
                        summary.ccmMasterDischargedCount += 1
                        if (row['30 Day Reported Hospitalization - from SNF Admit Date']) summary.h30Admit += 1
                    }
                }

                if (sheetName === 'PMR - Non CCM') {
                    if (row['SNF Facility Name'] === raw) {
                        summary.nonCcmMasterCount += 1
                        summary.h30Admit += 1
                    }
                }
            }
        }

        const facilitySummaryArray = Object.values(facilityPatientSummary)
        console.log("✅ Final patient + hospitalization summary:")
        console.dir(facilitySummaryArray, { depth: null })

        // build a Set for unique names
        const uniqueNames = new Set(facilitySummaryArray.map(s => s.facilityName));

        console.log("✅ Unique facilities in this batch:");
        console.log([...uniqueNames]);   // spread to array for printing

        const summaryRowsToInsert = facilitySummaryArray
            .map(summary => {
                const nursingHomeId = nameToId.get(summary.facilityName)
                if (!nursingHomeId) {
                    console.warn(`⚠️ Skipping insert: No matching nursing_home_id for "${summary.facilityName}"`)
                    return null
                }

                return {
                    nursing_home_id: nursingHomeId,
                    month,
                    year,
                    ccm_master_count: summary.ccmMasterCount,
                    ccm_master_discharged_count: summary.ccmMasterDischargedCount,
                    non_ccm_master_count: summary.nonCcmMasterCount,
                    h30_admit: summary.h30Admit,
                    //h30_discharge: summary.h30Discharge,
                    //h60: summary.h60,
                    //h90: summary.h90,
                    //h_reported: summary.hReported,
                }
            })
            .filter(Boolean)

        if (summaryRowsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('facility_readmission_summary')
                .insert(summaryRowsToInsert)

            if (insertError) {
                console.error("❌ Failed to insert summary rows:", insertError)
                return NextResponse.json({ error: "Insert failed", detail: insertError.message }, { status: 500 })
            }

            console.log(`✅ Inserted ${summaryRowsToInsert.length} summary rows to Supabase`)
        }

        console.log(`✅ Process completed in ${Date.now() - start}ms`)
        return NextResponse.json({
            inserted: toInsert.length,
            insertedSummaryRows: summaryRowsToInsert.length,
        })
    } catch (err: any) {
        console.error("💥 Unexpected error:", err)
        return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 })
    }
}
