"use client"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils" // helper for conditional classes

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FileDownIcon, FileIcon, FileTextIcon, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { logAuditEvent } from "@/lib/audit-logger"
import { PrinterIcon } from "lucide-react"
import { exportToPDF } from "@/lib/export-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format as dateformat } from "date-fns"
import * as XLSX from 'xlsx'

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LabelList,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { processPatientsWithLimit } from "@/app/actions/generate-case-study"

const facilityNameMap: Record<string, { patientsName: string; readmitName: string }> = {
    "Harborview Briarwood": {
        patientsName: "Briarwood Health Center by Harborview, LLC.",
        readmitName: "Harborview Briarwood"
    },
    // Add more mappings here as needed
}

const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString())

interface NursingHome {
    id: string
    name: string
}

interface CaseStudyHighlight {
    id: string
    patient_id: string
    highlight_text: string
    facility_summary_text: string
    engagement_summary_text: string
    hospital_discharge_summary_text: string
    highlight_quotes?: { quote: string; source_file_id: string }[]
    hospital_discharge_summary_quotes?: { quote: string; source_file_id: string }[]
    facility_summary_quotes?: { quote: string; source_file_id: string }[]
    engagement_summary_quotes?: { quote: string; source_file_id: string }[]
    interventions?: string[]
    outcomes?: string[]
    clinical_risks?: string[]
    detailed_interventions?: { intervention: string; source_quote: string; source_file_id: string }[]
    detailed_outcomes?: { outcome: string; source_quote: string; source_file_id: string }[]
    detailed_clinical_risks?: { risk: string; source_quote: string; source_file_id: string }[]
    created_at: string
    patient_name?: string
}

interface ReportGeneratorProps {
    nursingHomes: NursingHome[]
}

const initialPatientMetrics = {
    // Rolling (3-month) metrics
    rollingPuzzlePatients: 0,
    rollingPuzzleReadmissions: 0,
    rollingBambooReadmissions: 0,
    totalReadmissions3mo: 0,
    rollingRate: 0,

    // Display fields (exist in both old and new)
    facilityName: "",
    executiveSummary: "",
    closingStatement: "",
    publicLogoLink: "",
    nationalReadmissionsBenchmark: 0
};


export function Citations({ label, quotes }: { label: string; quotes: any[] }) {
    if (!quotes || quotes.length === 0) return null

    return (
        <div className="mt-2 ml-2">
            {quotes.map((q, index) => {
                let fileLink = null

                if (q.source_file_id) {
                    fileLink = `/api/download-file?id=${q.source_file_id}`
                }

                return (
                    <div key={index} className="mb-1 text-xs text-gray-600">
                        <span className="italic">"{q.quote}"</span>
                        {fileLink && (
                            <span>
                                &nbsp;(
                                <a
                                    href={fileLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-blue-600 hover:text-blue-800"
                                >
                                    {label}
                                </a>
                                )
                            </span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function lastThreeMonths(month: string, year: string) {
    const index = new Date(`${month} 1, ${year}`).getMonth(); // 0–11
    const yr = Number(year);

    const dates = [];

    for (let i = 0; i < 3; i++) {
        const d = new Date(yr, index - i, 1);

        dates.push({
            month: d.toLocaleString("en-US", { month: "long" }),
            year: String(d.getFullYear())
        });
    }

    return dates;
}

async function getFacilityStatic(nursingHomeId: string) {
    const supabase = createClientComponentClient()

    console.log("Running getFacilityStatic for - ", nursingHomeId)


    const { data, error } = await supabase
        .from('nursing_homes')
        .select('*')
        .eq('id', nursingHomeId)
        .single() // returns one row instead of array        

    console.log("getFacilityStatic Data is - ", data)

    if (error) {
        console.error("❌ Failed to fetch facility summary:", error)
        return null
    }

    return data
}

async function getFacilitySummary(nursingHomeId: string, month: string, year: string) {
    const supabase = createClientComponentClient()

    console.log("Running getFacilitySummary for - ", nursingHomeId)
    console.log("Running getFacilitySummary for - ", month)
    console.log("Running getFacilitySummary for - ", year)

    const { data, error } = await supabase
        .from('facility_readmission_summary')
        .select('*')
        .eq('nursing_home_id', nursingHomeId)
        .eq('month', month)
        .eq('year', year)
        .order('created_at', { ascending: false })     // sort newest first
        .limit(1)                                       // take only the latest


    console.log("getFacilitySummary Data is - ", data)

    if (error) {
        console.error("❌ Failed to fetch facility summary:", error)
        return null
    }

    return data?.[0] || null
}

async function getFilePaths(nursingHomeId: string, month: string, year: string) {
    const supabase = createClientComponentClient()

    console.log(`[getFilePaths] Querying for nursingHomeId=${nursingHomeId}, month=${month}, year=${year}`)

    const { data, error } = await supabase
        .from('nursing_home_files')
        .select('file_type, file_path, file_name')
        .eq('nursing_home_id', nursingHomeId)
        .eq('month', month)
        .eq('year', year)

    if (error || !data) {
        console.error("[getFilePaths] Error fetching file paths", error)
        return { patientsPath: null, nonCcmPath: null, bambooReportPath: null, adtReportPath: null, chargeCaptureReportPath: null }
    }

    console.log(`[getFilePaths] Found ${data.length} files:`, data.map(d => ({ type: d.file_type, name: d.file_name })))

    const patientsPath = data.find(d => d.file_type === 'Patients')?.file_path || null
    const nonCcmPath = data.find(d => d.file_type === 'Non CCM')?.file_path || null
    const bambooReportPath = data.find(d => d.file_type === 'Bamboo Report')?.file_path || null
    const adtReportPath = data.find(d => d.file_type === 'Month ADT Report')?.file_path || null
    const chargeCaptureReportPath = data.find(d => d.file_type === 'Charge Capture')?.file_path || null

    console.log(`[getFilePaths] ADT Report: ${adtReportPath ? 'FOUND' : 'NOT FOUND'}`)
    console.log(`[getFilePaths] Charge Capture: ${chargeCaptureReportPath ? 'FOUND' : 'NOT FOUND'}`)

    return { patientsPath, nonCcmPath, bambooReportPath, adtReportPath, chargeCaptureReportPath }
}

async function getBambooReportPath(month: string, year: string, state: string) {
    const supabase = createClientComponentClient()
    const PUZZLE_FACILITY_ID = "1688ba99-e4d3-4543-a0ba-7caa37e33a1c"

    const { data, error } = await supabase
        .from('nursing_home_files')
        .select('file_type, file_path, us_state')
        .eq('nursing_home_id', PUZZLE_FACILITY_ID)
        .eq('month', month)
        .eq('year', year)
        .eq('us_state', state)
        .eq('file_type', 'Bamboo Report')


    if (error || !data) {
        console.error("Error fetching Bamboo Report file path", error)
        return null
    }

    return data[0]?.file_path || null
}

// Charge Capture is a company-wide file, stored under the master facility
async function getChargeCaptureReportPath(month: string, year: string) {
    const supabase = createClientComponentClient()
    const PUZZLE_FACILITY_ID = "1688ba99-e4d3-4543-a0ba-7caa37e33a1c"

    const { data, error } = await supabase
        .from('nursing_home_files')
        .select('file_type, file_path')
        .eq('nursing_home_id', PUZZLE_FACILITY_ID)
        .eq('month', month)
        .eq('year', year)
        .eq('file_type', 'Charge Capture')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error || !data) {
        console.error("Error fetching Charge Capture file path", error)
        return null
    }

    return data[0]?.file_path || null
}

async function fetchAndParseExcel(path: string | null): Promise<XLSX.WorkSheet | null> {
    if (!path) return null
    const supabase = createClientComponentClient()

    const { data, error } = await supabase.storage.from('nursing-home-files').download(path)
    if (error || !data) {
        console.error("Error downloading file", error)
        return null
    }

    const arrayBuffer = await data.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    return workbook.Sheets[workbook.SheetNames[0]]
}

// Parse ADT Report (CSV) to get patients with Discharge = "Y"
async function parseDischargedPatientsFromADT(
    filePath: string | null,
    facilityName: string
): Promise<Array<{ firstName: string; lastName: string }>> {
    console.log(`[parseDischargedPatientsFromADT] Starting parse for "${facilityName}", path: ${filePath}`)

    if (!filePath) {
        console.log("[parseDischargedPatientsFromADT] No file path provided")
        return []
    }

    const supabase = createClientComponentClient()
    console.log(`[parseDischargedPatientsFromADT] Downloading file from storage...`)
    const { data, error } = await supabase.storage.from('nursing-home-files').download(filePath)

    if (error || !data) {
        console.error("[parseDischargedPatientsFromADT] Error downloading ADT file", error)
        return []
    }

    console.log(`[parseDischargedPatientsFromADT] File downloaded successfully, size: ${data.size} bytes`)

    const text = await data.text()
    const lines = text.split('\n')

    console.log(`[parseDischargedPatientsFromADT] CSV has ${lines.length} lines`)

    if (lines.length < 2) {
        console.log("[parseDischargedPatientsFromADT] CSV has less than 2 lines, returning empty")
        return []
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const dischargeIndex = headers.findIndex(h => h === 'Discharge')
    const dischargeStatusIndex = headers.findIndex(h => h === 'Discharge Status')
    const firstNameIndex = headers.findIndex(h => h === 'Resident First Name')
    const lastNameIndex = headers.findIndex(h => h === 'Resident Last Name')
    const facilityNameIndex = headers.findIndex(h => h === 'Facility Name')

    if (dischargeIndex === -1 || firstNameIndex === -1 || lastNameIndex === -1) {
        console.error("Required columns not found in ADT file")
        return []
    }

    // Discharge statuses to exclude (case-insensitive partial match)
    const excludedStatuses = ['expired', 'funeral home', 'hospice', 'hospital']

    const dischargedPatients: Array<{ firstName: string; lastName: string }> = []

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Simple CSV parsing (handles basic cases)
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))

        const discharge = values[dischargeIndex]
        const dischargeStatus = dischargeStatusIndex !== -1 ? values[dischargeStatusIndex]?.toLowerCase() || '' : ''
        const rowFacility = facilityNameIndex !== -1 ? values[facilityNameIndex] : ''

        // Check if this is a discharge record and optionally match facility
        if (discharge === 'Y') {
            // Exclude patients with certain discharge statuses
            const isExcluded = excludedStatuses.some(status => dischargeStatus.includes(status))
            if (isExcluded) {
                continue
            }

            // If facility name column exists, filter by it; otherwise include all
            if (facilityNameIndex === -1 || rowFacility.toLowerCase() === facilityName.toLowerCase()) {
                const firstName = values[firstNameIndex]?.toLowerCase().trim() || ''
                const lastName = values[lastNameIndex]?.toLowerCase().trim() || ''

                if (firstName && lastName) {
                    // Avoid duplicates
                    const exists = dischargedPatients.some(
                        p => p.firstName === firstName && p.lastName === lastName
                    )
                    if (!exists) {
                        dischargedPatients.push({ firstName, lastName })
                    }
                }
            }
        }
    }

    console.log(`Found ${dischargedPatients.length} discharged patients from ADT for "${facilityName}"`)
    return dischargedPatients
}

// Parse Charge Capture (Excel) to get patients for a specific facility
async function parsePatientsFromChargeCapture(
    filePath: string | null,
    facilityName: string
): Promise<Array<{ firstName: string; lastName: string }>> {
    console.log(`[parsePatientsFromChargeCapture] Starting parse for "${facilityName}", path: ${filePath}`)

    if (!filePath) {
        console.log("[parsePatientsFromChargeCapture] No file path provided")
        return []
    }

    const supabase = createClientComponentClient()
    console.log(`[parsePatientsFromChargeCapture] Downloading file from storage...`)
    const { data, error } = await supabase.storage.from('nursing-home-files').download(filePath)

    if (error || !data) {
        console.error("[parsePatientsFromChargeCapture] Error downloading Charge Capture file", error)
        return []
    }

    console.log(`[parsePatientsFromChargeCapture] File downloaded successfully, size: ${data.size} bytes`)

    const arrayBuffer = await data.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    if (!sheet) {
        console.error("[parsePatientsFromChargeCapture] No sheet found in Charge Capture file")
        return []
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
    console.log(`[parsePatientsFromChargeCapture] Processing Charge Capture with ${rows.length} rows`)

    const patients: Array<{ firstName: string; lastName: string }> = []

    // Normalize facility name for matching (remove trailing suffixes like "(M)")
    const normalizedFacilityName = facilityName.toLowerCase().replace(/\s*\(m\)\s*$/i, '').trim()

    for (const row of rows) {
        const rowFacility = row['Facility']?.toString().trim() || ''
        // Normalize row facility name for comparison
        const normalizedRowFacility = rowFacility.toLowerCase().replace(/\s*\(m\)\s*$/i, '').trim()

        // Check if this row is for the selected facility (flexible match)
        if (normalizedRowFacility === normalizedFacilityName ||
            normalizedRowFacility.startsWith(normalizedFacilityName) ||
            normalizedFacilityName.startsWith(normalizedRowFacility)) {
            const firstName = row['Patient First Name']?.toString().toLowerCase().trim() || ''
            const lastName = row['Patient Last Name']?.toString().toLowerCase().trim() || ''

            if (firstName && lastName) {
                // Avoid duplicates
                const exists = patients.some(
                    p => p.firstName === firstName && p.lastName === lastName
                )
                if (!exists) {
                    patients.push({ firstName, lastName })
                }
            }
        }
    }

    console.log(`Found ${patients.length} unique patients in Charge Capture for "${facilityName}"`)
    return patients
}

// Calculate Total Puzzle Continuity Care Patients Tracked
// These are patients discharged from ADT that also exist in Charge Capture
async function calculateDischargedPuzzlePatients(
    adtPath: string | null,
    chargeCapturePath: string | null,
    facilityName: string
): Promise<number> {
    console.log(`[calculateDischargedPuzzlePatients] Starting calculation for "${facilityName}"`)
    console.log(`[calculateDischargedPuzzlePatients] ADT Path: ${adtPath}`)
    console.log(`[calculateDischargedPuzzlePatients] Charge Capture Path: ${chargeCapturePath}`)

    if (!adtPath || !chargeCapturePath) {
        console.log("[calculateDischargedPuzzlePatients] Missing ADT or Charge Capture file path - returning 0")
        return 0
    }

    const [adtPatients, chargeCapturePatients] = await Promise.all([
        parseDischargedPatientsFromADT(adtPath, facilityName),
        parsePatientsFromChargeCapture(chargeCapturePath, facilityName)
    ])

    console.log(`[calculateDischargedPuzzlePatients] ADT discharged patients: ${adtPatients.length}`)
    console.log(`[calculateDischargedPuzzlePatients] Charge Capture patients: ${chargeCapturePatients.length}`)

    // Match patients: discharged from ADT AND exist in Charge Capture
    const matchedPatients = adtPatients.filter(adtPatient =>
        chargeCapturePatients.some(
            ccPatient =>
                ccPatient.firstName === adtPatient.firstName &&
                ccPatient.lastName === adtPatient.lastName
        )
    )

    console.log(`[calculateDischargedPuzzlePatients] MATCHED patients: ${matchedPatients.length}`)
    if (matchedPatients.length > 0) {
        console.log(`[calculateDischargedPuzzlePatients] Matched patient names:`, matchedPatients)
    }

    return matchedPatients.length
}

async function parseReadmittedPatientsFromExcel(
    filePath: string | null,
    facilityName: string
): Promise<Array<{
    name: string;
    hospitalDischargeDate: string;
    snfDischargeDate: string;
    hospitalReadmitDate: string;
    hospitalName: string;
    readmissionReason: string;
}>> {
    console.log("\n┌──────────────────────────────────────────────────────────────┐")
    console.log("│ PARSING READMITTED PATIENTS FROM EXCEL                       │")
    console.log("└──────────────────────────────────────────────────────────────┘")
    console.log(`  📁 File Path: ${filePath}`)
    console.log(`  🏥 Facility Name: ${facilityName}`)

    if (!filePath) {
        console.log("  ⚠️ No file path provided - returning empty array")
        return []
    }

    const supabase = createClientComponentClient()
    console.log("  📥 Downloading file from storage...")
    const { data, error } = await supabase.storage.from('nursing-home-files').download(filePath)

    if (error || !data) {
        console.error("  ❌ Error downloading file for readmitted patients:", error)
        return []
    }
    console.log(`  ✅ File downloaded successfully (${data.size} bytes)`)

    const arrayBuffer = await data.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    console.log(`  📊 Workbook loaded. Available sheets: ${workbook.SheetNames.join(", ")}`)

    const readmittedPatients: Array<{
        name: string;
        hospitalDischargeDate: string;
        snfDischargeDate: string;
        hospitalReadmitDate: string;
        hospitalName: string;
        readmissionReason: string;
    }> = []

    // Track seen patients to avoid duplicates (key = name + hospitalDischargeDate + snfDischargeDate + hospitalReadmitDate)
    const seenPatients = new Set<string>()

    // Check all three sheets: CCM Master, CCM Master Discharged, and PMR - Non CCM
    const sheetConfigsReadmissionData = [
        { name: 'CCM Master', hospitalName: '', readmissionCaseField: '30 Day Reported Hospitalization - from SNF Admit Date', hospitalReadmitDateField: '30 Day Reported Hospitalization - from SNF Discharge Date', hospitalReadmitReasonField: '30 Day Hospitalization Information - from SNF Discharge Date' },
        { name: 'CCM Master Discharged', hospitalName: '', readmissionCaseField: '30 Day Reported Hospitalization - from SNF Admit Date', hospitalReadmitDateField: '30 Day Reported Hospitalization - from SNF Discharge Date', hospitalReadmitReasonField: '30 Day Hospitalization Information - from SNF Discharge Date' },
        { name: 'PMR - Non CCM', hospitalName: 'Hospital System', readmissionCaseField: 'Patient Name', hospitalReadmitDateField: 'Reported Hospitalization', hospitalReadmitReasonField: 'Reason for Hospitalization' },
    ]

    const formatDate = (dateValue: any): string => {
        if (!dateValue) return 'N/A'
        try {
            // Handle Excel date numbers
            if (typeof dateValue === 'number') {
                const excelEpoch = new Date(1899, 11, 30)
                const date = new Date(excelEpoch.getTime() + dateValue * 86400000)
                return date.toLocaleDateString()
            }
            // Handle date strings
            const date = new Date(dateValue)
            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
        } catch {
            return 'N/A'
        }
    }

    // Parse "Hospital Name - Reason" format from the info field
    const parseAdmitReason = (reasonStr: any): { hospitalName: string; readmitReason: string } => {
        console.log(`     🔍 Parsing hospital info: "${reasonStr}"`)
        if (!reasonStr) {
            console.log(`     ⚠️ Empty info string`)
            return { hospitalName: 'N/A', readmitReason: 'N/A' }
        }

        const str = reasonStr.toString().trim()
        if (!str) {
            console.log(`     ⚠️ Empty after trim`)
            return { hospitalName: 'N/A', readmitReason: 'N/A' }
        }

        // Try to split by " - " (with spaces around dash) first for "Hospital Name - Reason" format
        const dashWithSpaces = str.split(' - ')
        if (dashWithSpaces.length >= 2) {
            const hospitalName = dashWithSpaces[0].trim() || 'N/A'
            const readmitReason = dashWithSpaces.slice(1).join(' - ').trim() || 'N/A'
            console.log(`     ✅ Parsed with " - ": Hospital="${hospitalName}", Reason="${readmitReason}"`)
            return { hospitalName, readmitReason }
        }

        // Try to split by just "-" if no spaces around it
        const parts = str.split('-').map((p: string) => p.trim())
        if (parts.length >= 2) {
            const hospitalName = parts[0] || 'N/A'
            const readmitReason = parts.slice(1).join('-').trim() || 'N/A'
            console.log(`     ✅ Parsed with "-": Hospital="${hospitalName}", Reason="${readmitReason}"`)
            return { hospitalName, readmitReason }
        }

        // If no separator found, treat the whole string as the hospital name
        console.log(`     ⚠️ No separator found, using whole string as hospital name: "${str}"`)
        return { hospitalName: str, readmitReason: 'N/A' }
    }


    const parseDateRange = (
        dateRangeStr: any
    ): { readmitDate: string | number; reDischargeDate: string | number } => {
        // Normalize values so numeric Excel serials remain numbers and can be converted later
        const normalizeValue = (value: any): string | number => {
            if (typeof value === 'number') return value
            const str = value?.toString().trim()
            if (!str) return 'N/A'

            const numericVal = Number(str)
            if (!Number.isNaN(numericVal)) return numericVal
            return str
        }

        if (dateRangeStr === null || dateRangeStr === undefined || dateRangeStr === '') {
            return { readmitDate: 'N/A', reDischargeDate: 'N/A' }
        }

        const str = dateRangeStr.toString().trim()
        const parts = str.split('-').map((p: string) => p.trim()).filter(Boolean)

        if (parts.length === 2) {
            return {
                readmitDate: normalizeValue(parts[0]),
                reDischargeDate: normalizeValue(parts[1])
            }
        }

        // If not in range format, might be a single date
        return { readmitDate: normalizeValue(str), reDischargeDate: 'N/A' }
    }

    for (const config of sheetConfigsReadmissionData) {
        const sheet = workbook.Sheets[config.name]
        if (!sheet) {
            console.log(`\n  📄 Sheet "${config.name}": NOT FOUND - skipping`)
            continue
        }

        const sheetData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
        console.log(`\n  📄 Sheet "${config.name}": Processing ${sheetData.length} rows`)

        // Log available columns for debugging
        if (sheetData.length > 0) {
            const columns = Object.keys(sheetData[0])
            console.log(`     📋 Available columns (${columns.length}):`)
            // Find columns that might contain "30 Day" or "Hospitalization"
            const relevantCols = columns.filter(c =>
                c.toLowerCase().includes('30 day') ||
                c.toLowerCase().includes('hospitalization') ||
                c.toLowerCase().includes('info')
            )
            if (relevantCols.length > 0) {
                console.log(`     🔍 Relevant columns for hospital info:`, relevantCols)
            }
        }

        let foundInSheet = 0
        let skippedDuplicates = 0

        for (const row of sheetData) {
            const snfFacility = row['SNF Facility Name']?.toString().trim()
            const patientName = row['Patient Name']?.toString().trim()

            // Different logic based on sheet type
            let hasReadmission = false
            let parsedReadmitDate: string | number = 'N/A'
            let readmissionReason = 'N/A'
            let hospitalName = 'N/A'

            let readmissionDateField = ''
            let readmissionReasonField = ''
            const hospitalDischargeDate = row['Hospital Discharge Date']
            const snfDischargeDate = row['SNF Discharge Date']

            hasReadmission = row[config.readmissionCaseField] ? true : false
            if (hasReadmission && (snfFacility && snfFacility.toLowerCase() === facilityName.toLowerCase())) {
                readmissionDateField = row[config.hospitalReadmitDateField]
                readmissionReasonField = row[config.hospitalReadmitReasonField]

                if (config.name === 'PMR - Non CCM') {

                    readmissionReason = row['Reason for Hospitalization'].toString().trim()
                    hospitalName = row['Readmit Hospital System'].toString().trim()
                } else {
                    readmissionReason = parseAdmitReason(readmissionReasonField).readmitReason
                    hospitalName = parseAdmitReason(readmissionReasonField).hospitalName

                }
                console.log(`Hospital Name from ${config.name} is - ${hospitalName}`)
                console.log(`Readmission Reason from ${config.name} is - ${readmissionReason}`)

                console.log("date range field is - ", readmissionDateField)
                // Parse the date range format "04/18/2025 - 04/25/2025"
                const dateRange = parseDateRange(readmissionDateField)
                console.log("date range parsed is - ", dateRange)

                parsedReadmitDate = dateRange.readmitDate  // Hospital readmit date (first date in range)
                console.log("1st date read is  - ", parsedReadmitDate)

                console.log(`${config.name}: Patient ${patientName}, Parsed readmit date: ${parsedReadmitDate}, hospital Name: ${hospitalName}, readmissionReason: ${readmissionReason}`)

                const formattedHospitalDischargeDate = formatDate(hospitalDischargeDate)
                const formattedSnfDischargeDate = formatDate(snfDischargeDate)
                const formattedHospitalReadmitDate = formatDate(parsedReadmitDate)

                // Create unique key for deduplication
                const uniqueKey = `${patientName.toLowerCase()}|${formattedHospitalDischargeDate}|${formattedSnfDischargeDate}|${formattedHospitalReadmitDate}`

                if (seenPatients.has(uniqueKey)) {
                    console.log(`     ⚠️ DUPLICATE DETECTED - skipping patient: ${patientName} (key: ${uniqueKey})`)
                    skippedDuplicates++
                    continue
                }

                seenPatients.add(uniqueKey)
                foundInSheet++
                console.log(`     ✅ Adding unique patient: ${patientName}`)

                readmittedPatients.push({
                    name: patientName,
                    hospitalDischargeDate: formattedHospitalDischargeDate,
                    snfDischargeDate: formattedSnfDischargeDate,
                    hospitalReadmitDate: formattedHospitalReadmitDate,
                    hospitalName: hospitalName,
                    readmissionReason: readmissionReason
                })

            }


            // Only process if there's a readmission for this facility
            if (!snfFacility || snfFacility.toLowerCase() !== facilityName.toLowerCase() || !hasReadmission || !patientName) {
                continue
            }
        }
        console.log(`     📊 Sheet "${config.name}" summary: Found ${foundInSheet} patients, Skipped ${skippedDuplicates} duplicates`)
    }

    console.log("\n┌──────────────────────────────────────────────────────────────┐")
    console.log("│ READMITTED PATIENTS PARSING COMPLETE                         │")
    console.log("└──────────────────────────────────────────────────────────────┘")
    console.log(`  📊 Total unique readmitted patients: ${readmittedPatients.length}`)
    if (readmittedPatients.length > 0) {
        console.log("  📋 Patient list:")
        readmittedPatients.forEach((p, i) => {
            console.log(`     ${i + 1}. ${p.name} | Hospital: ${p.hospitalName} | Reason: ${p.readmissionReason}`)
        })
    }
    console.log("")

    return readmittedPatients
}



export function ReportGenerator({ nursingHomes }: ReportGeneratorProps) {
    const [selectedNursingHomeId, setSelectedNursingHomeId] = useState<string>("")
    const [selectedNursingHomeName, setSelectedNursingHomeName] = useState<string | null>(null)
    const [selectedState, setSelectedState] = useState<string>("")

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString("default", { month: "long" }))
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
    const [isGenerating, setIsGenerating] = useState(false)
    const [reportGenerated, setReportGenerated] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
    const [caseStudies, setCaseStudies] = useState<CaseStudyHighlight[]>([])
    const [isLoadingCaseStudies, setIsLoadingCaseStudies] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)
    const readmissionsChartRef = useRef<HTMLDivElement>(null)
    const touchpointsChartRef = useRef<HTMLDivElement>(null)
    const clinicalRisksChartRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    let [categorizedInterventions, setCategorizedInterventions] = useState<Record<string, string[]>>({})
    const [facilityReadmissionData, setFacilityReadmissionData] = useState<any>()
    const [facilityData, setFacilityData] = useState<any>()
    const [open, setOpen] = useState(false)

    // Add intervention counts state for the Touchpoints chart
    const [interventionCounts, setInterventionCounts] = useState<Array<{ name: string; count: number }>>([
    ])

    // Add clinical risks state for the Top Clinical Risks chart
    const [clinicalRisks, setClinicalRisks] = useState<Array<{ risk: string; count: number }>>([
    ])

    // Add readmitted patients state
    const [readmittedPatients, setReadmittedPatients] = useState<Array<{
        name: string;
        hospitalDischargeDate: string;
        snfDischargeDate: string;
        hospitalReadmitDate: string;
        hospitalName: string;
        readmissionReason: string;
    }>>([
    ])

    // Add patient metrics state
    const [patientMetrics, setPatientMetrics] = useState(initialPatientMetrics)

    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null)

    // Track per-section patient selections
    const [selectedCaseStudyPatients, setSelectedCaseStudyPatients] = useState<string[]>([])
    const [selectedInterventionPatients, setSelectedInterventionPatients] = useState<string[]>([])
    const [availablePatients, setAvailablePatients] = useState<{ id: string; name: string; created_at: string }[]>([])
    const [useAISelection, setUseAISelection] = useState(false)
    const [isLoadingPatients, setIsLoadingPatients] = useState(false)
    const [isAISelecting, setIsAISelecting] = useState(false)
    const [showPatientPHI, setShowPatientPHI] = useState(true)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingStudyId, setEditingStudyId] = useState<string | null>(null)
    const [editedStudy, setEditedStudy] = useState<CaseStudyHighlight | null>(null)
    const [isSavingStudy, setIsSavingStudy] = useState(false)

    const selectedPatientIds = useMemo(
        () => Array.from(new Set([...selectedCaseStudyPatients, ...selectedInterventionPatients])),
        [selectedCaseStudyPatients, selectedInterventionPatients]
    )

    const caseStudyEntries = useMemo(() => {
        if (selectedCaseStudyPatients.length === 0) return []
        return caseStudies.filter((study) => selectedCaseStudyPatients.includes(study.patient_id))
    }, [caseStudies, selectedCaseStudyPatients])

    const interventionEntries = useMemo(() => {
        if (selectedInterventionPatients.length === 0) return []
        return caseStudies.filter((study) => selectedInterventionPatients.includes(study.patient_id))
    }, [caseStudies, selectedInterventionPatients])

    const formatPatientName = useCallback(
        (rawName?: string) => {
            const name = (rawName || "").trim()
            if (!name) return "Unknown"

            const toTitleCase = (value: string) =>
                value
                    .split(/\s+/)
                    .map((part) =>
                        part
                            .split("-")
                            .map((p) => (p ? `${p[0].toUpperCase()}${p.slice(1).toLowerCase()}` : ""))
                            .join("-")
                    )
                    .join(" ")

            const parts = name.split(/\s+/)
            const first = parts[0] || ""
            const last = parts.slice(1).join(" ")

            if (showPatientPHI) {
                if (first && last) {
                    return `${first.charAt(0).toUpperCase()}. ${toTitleCase(last)}`
                }
                return toTitleCase(name)
            }

            const firstInitial = first ? `${first.charAt(0).toUpperCase()}.` : ""
            const lastInitial = last ? `${last.charAt(0).toUpperCase()}.` : ""
            const masked = [firstInitial, lastInitial].filter(Boolean).join(" ")

            return masked || "Unknown"
        },
        [showPatientPHI]
    )

    const applyPatientPrivacy = useCallback(
        (entries: CaseStudyHighlight[]) =>
            entries.map((study) => ({
                ...study,
                patient_name: formatPatientName(study.patient_name),
            })),
        [formatPatientName]
    )

    const normalizeDetailedEntries = useCallback(
        (entries: any[] | undefined, key: "intervention" | "outcome") => {
            if (!Array.isArray(entries)) return []
            return entries.map((item) => {
                if (!item) {
                    return { [key]: "" }
                }
                if (typeof item === "string") {
                    try {
                        const parsed = JSON.parse(item)
                        if (parsed && typeof parsed === "object") {
                            return parsed
                        }
                        return { [key]: parsed ?? "" }
                    } catch {
                        return { [key]: item }
                    }
                }
                return item
            })
        },
        []
    )

    const handleOpenEditDialog = useCallback(
        (study: CaseStudyHighlight) => {
            const cloned = JSON.parse(JSON.stringify(study)) as CaseStudyHighlight
            cloned.detailed_interventions = normalizeDetailedEntries(cloned.detailed_interventions, "intervention")
            cloned.detailed_outcomes = normalizeDetailedEntries(cloned.detailed_outcomes, "outcome")
            setEditingStudyId(study.id)
            setEditedStudy(cloned)
            setIsEditDialogOpen(true)
        },
        [normalizeDetailedEntries]
    )

    const handleCloseEditDialog = useCallback(() => {
        setIsEditDialogOpen(false)
        setEditingStudyId(null)
        setEditedStudy(null)
        setIsSavingStudy(false)
    }, [])

    const handleEditedFieldChange = useCallback((field: keyof CaseStudyHighlight, value: string) => {
        setEditedStudy((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                [field]: value,
            }
        })
    }, [])

    const handleDetailedEntryChange = useCallback(
        (field: "detailed_interventions" | "detailed_outcomes", index: number, key: "intervention" | "outcome", value: string) => {
            setEditedStudy((prev) => {
                if (!prev) return prev
                const existingEntries = Array.isArray(prev[field]) ? [...(prev[field] as any[])] : []
                const entry = { ...(existingEntries[index] || {}) }
                entry[key] = value
                existingEntries[index] = entry
                return {
                    ...prev,
                    [field]: existingEntries,
                } as CaseStudyHighlight
            })
        },
        []
    )

    const handleSaveEditedStudy = useCallback(async () => {
        if (!editedStudy || !editingStudyId) return
        try {
            setIsSavingStudy(true)
            const supabase = createClientComponentClient()

            const sanitizeText = (value?: string | null) => (value ? value.trim() : "")

            const cleanedInterventions = (Array.isArray(editedStudy.detailed_interventions) ? editedStudy.detailed_interventions : []).map(
                (item: any) => ({
                    ...item,
                    intervention: sanitizeText(item?.intervention),
                })
            )

            const cleanedOutcomes = (Array.isArray(editedStudy.detailed_outcomes) ? editedStudy.detailed_outcomes : []).map(
                (item: any) => ({
                    ...item,
                    outcome: sanitizeText(item?.outcome),
                })
            )

            const payload: Record<string, any> = {
                highlight_text: sanitizeText(editedStudy.highlight_text),
                hospital_discharge_summary_text: sanitizeText(editedStudy.hospital_discharge_summary_text),
                facility_summary_text: sanitizeText(editedStudy.facility_summary_text),
                engagement_summary_text: sanitizeText(editedStudy.engagement_summary_text),
                detailed_interventions: cleanedInterventions,
                detailed_outcomes: cleanedOutcomes,
            }

            const { error } = await supabase
                .from("patient_case_study_highlights")
                .update(payload)
                .eq("id", editingStudyId)

            if (error) {
                throw error
            }

            setCaseStudies((prev) =>
                prev.map((study) =>
                    study.id === editingStudyId
                        ? {
                            ...study,
                            ...payload,
                        }
                        : study
                )
            )

            toast({
                title: "Saved",
                description: "Updates saved successfully.",
            })
            handleCloseEditDialog()
        } catch (error) {
            console.error("Error saving study:", error)
            toast({
                title: "Error",
                description: "Failed to save changes. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsSavingStudy(false)
        }
    }, [editedStudy, editingStudyId, toast, handleCloseEditDialog])

    const phiPreviewExample = useMemo(() => formatPatientName("Casey Carrier"), [formatPatientName])

    const safeInterventionCounts = useMemo(
        () =>
            Array.isArray(interventionCounts)
                ? interventionCounts.filter(
                    (item): item is { name: string; count: number } =>
                        !!item && typeof item.name === "string" && typeof item.count === "number"
                )
                : [],
        [interventionCounts]
    )

    // Clear report data when the selection changes
    useEffect(() => {
        setReportGenerated(false)
        setCaseStudies([])
        setSelectedCaseStudyPatients([])
        setSelectedInterventionPatients([])
        setExpandedPatientId(null)
        setAvailablePatients([])
        setCategorizedInterventions({})
        setInterventionCounts([])
        setClinicalRisks([])
        setReadmittedPatients([])
        setPatientMetrics(initialPatientMetrics)
        setFacilityReadmissionData(undefined)
        setFacilityData(undefined)
    }, [selectedNursingHomeId, selectedMonth, selectedYear])

    // Calculate metrics when Generate Report is clicked
    const calculateMetrics = async () => {
        const startTime = performance.now();
        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║           METRICS CALCULATION STARTED                          ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log(`[${new Date().toISOString()}] calculateMetrics triggered`);
        console.log("📋 Input Parameters:");
        console.log("  • Nursing Home ID:", selectedNursingHomeId);
        console.log("  • Nursing Home Name:", selectedNursingHomeName);
        console.log("  • Month:", selectedMonth);
        console.log("  • Year:", selectedYear);

        if (!(selectedNursingHomeId && selectedMonth && selectedYear)) {
            console.warn("⚠️ Missing required parameters for metrics calculation.");
            console.log("  • Has nursingHomeId:", !!selectedNursingHomeId);
            console.log("  • Has month:", !!selectedMonth);
            console.log("  • Has year:", !!selectedYear);
            return;
        }

        console.log("\n📊 STEP 1: Fetching facility static info...");
        const facilityStaticInfo = await getFacilityStatic(selectedNursingHomeId);
        console.log("✅ Facility Static Info Retrieved:");
        console.log("  • Name:", facilityStaticInfo?.name);
        console.log("  • State:", facilityStaticInfo?.us_state);
        console.log("  • Logo URL:", facilityStaticInfo?.logo_url);
        setFacilityData(facilityStaticInfo);

        let allReadmitted: any[] = [];
        let allData: any[] = [];
        let totalDischargedPuzzlePatients = 0;

        // Rolling 3-month logic
        if (facilityStaticInfo?.us_state) {
            const monthsToCheck = lastThreeMonths(selectedMonth, selectedYear);
            console.log("\n📅 STEP 2: Processing Rolling 3-Month Window");
            console.log("  Months to process:", monthsToCheck.map(m => `${m.month} ${m.year}`).join(", "));

            for (let i = 0; i < monthsToCheck.length; i++) {
                const { month, year } = monthsToCheck[i];
                console.log("\n┌──────────────────────────────────────────────────────────────┐");
                console.log(`│ MONTH ${i + 1}/3: ${month} ${year}                                       │`);
                console.log("└──────────────────────────────────────────────────────────────┘");

                // Facility summary
                console.log(`  📄 Fetching facility summary...`);
                const summary = await getFacilitySummary(selectedNursingHomeId, month, year);
                if (summary) {
                    console.log(`  ✅ Facility Summary Found:`);
                    console.log(`     • CCM Master Count: ${summary.ccm_master_count || 0}`);
                    console.log(`     • CCM Master Discharged: ${summary.ccm_master_discharged_count || 0}`);
                    console.log(`     • Non-CCM Count: ${summary.non_ccm_master_count || 0}`);
                    console.log(`     • H30 Admit: ${summary.h30_admit || 0}`);
                    allData.push(summary);
                } else {
                    console.log(`  ⚠️ No facility summary data found for ${month} ${year}`);
                }

                // Get file paths for ADT and Charge Capture
                console.log(`  📁 Fetching file paths...`);
                const { adtReportPath, chargeCaptureReportPath: localChargeCaptureReportPath } = await getFilePaths(
                    selectedNursingHomeId,
                    month,
                    year
                );

                // Charge Capture is a company-wide file - if not found locally, check master facility
                let chargeCaptureReportPath = localChargeCaptureReportPath;
                if (!chargeCaptureReportPath) {
                    console.log(`  📁 Charge Capture not found locally, checking master facility...`);
                    chargeCaptureReportPath = await getChargeCaptureReportPath(month, year);
                }

                console.log(`  📋 File Paths:`);
                console.log(`     • ADT Report: ${adtReportPath || '❌ NOT FOUND'}`);
                console.log(`     • Charge Capture: ${chargeCaptureReportPath || '❌ NOT FOUND'}${chargeCaptureReportPath && !localChargeCaptureReportPath ? ' (from master facility)' : ''}`);

                // Calculate discharged Puzzle patients (ADT discharged + in Charge Capture)
                if (adtReportPath && chargeCaptureReportPath && selectedNursingHomeName) {
                    console.log(`  🔄 Calculating discharged Puzzle patients...`);
                    const dischargedCount = await calculateDischargedPuzzlePatients(
                        adtReportPath,
                        chargeCaptureReportPath,
                        selectedNursingHomeName
                    );
                    console.log(`  ✅ Discharged Puzzle Patients for ${month} ${year}: ${dischargedCount}`);
                    totalDischargedPuzzlePatients += dischargedCount;
                    console.log(`  📊 Running Total Discharged Puzzle Patients: ${totalDischargedPuzzlePatients}`);
                } else {
                    console.log(`  ⚠️ Skipping discharged calculation - missing files:`);
                    if (!adtReportPath) console.log(`     • ADT Report missing`);
                    if (!chargeCaptureReportPath) console.log(`     • Charge Capture missing`);
                    if (!selectedNursingHomeName) console.log(`     • Nursing Home Name missing`);
                }

                // Bamboo readmissions
                console.log(`  📁 Fetching Bamboo Report path...`);
                const bambooReportPath = await getBambooReportPath(
                    month,
                    year,
                    facilityStaticInfo.us_state
                );
                console.log(`     • Bamboo Report: ${bambooReportPath || '❌ NOT FOUND'}`);

                if (bambooReportPath && selectedNursingHomeName) {
                    console.log(`  🔄 Parsing readmitted patients from Bamboo...`);
                    const readmitted = await parseReadmittedPatientsFromExcel(
                        bambooReportPath,
                        selectedNursingHomeName
                    );

                    console.log(`  ✅ Readmitted Patients from Bamboo: ${readmitted.length}`);
                    if (readmitted.length > 0) {
                        console.log(`     Patient Names: ${readmitted.map(p => p.name).join(", ")}`);
                    }

                    allReadmitted.push(...readmitted);
                    console.log(`  📊 Running Total Readmitted: ${allReadmitted.length}`);
                } else {
                    console.log(`  ⚠️ Skipping Bamboo readmissions - missing:`);
                    if (!bambooReportPath) console.log(`     • Bamboo Report not found`);
                    if (!selectedNursingHomeName) console.log(`     • Nursing Home Name missing`);
                }
            }

            console.log("\n┌──────────────────────────────────────────────────────────────┐");
            console.log("│ 3-MONTH ROLLING TOTALS (before deduplication)                │");
            console.log("└──────────────────────────────────────────────────────────────┘");
            console.log("  • Total Readmitted (all 3 months, raw):", allReadmitted.length);
            console.log("  • Total Discharged Puzzle Patients (all 3 months):", totalDischargedPuzzlePatients);
            console.log("  • Facility Summaries Collected:", allData.length);

            // Deduplicate across all 3 months (same patient may appear in multiple months' reports)
            const seenAcrossMonths = new Set<string>();
            const uniqueReadmitted = allReadmitted.filter(patient => {
                const key = `${patient.name.toLowerCase()}|${patient.hospitalDischargeDate}|${patient.snfDischargeDate}|${patient.hospitalReadmitDate}`;
                if (seenAcrossMonths.has(key)) {
                    console.log(`  ⚠️ Cross-month duplicate removed: ${patient.name}`);
                    return false;
                }
                seenAcrossMonths.add(key);
                return true;
            });

            console.log(`\n  📊 After cross-month deduplication: ${uniqueReadmitted.length} unique patients (removed ${allReadmitted.length - uniqueReadmitted.length} duplicates)`);
            allReadmitted = uniqueReadmitted;
        } else {
            console.warn("⚠️ Facility state not available — skipping 3-month rolling logic.");
            console.log("  • facilityStaticInfo:", facilityStaticInfo);
            console.log("  • us_state:", facilityStaticInfo?.us_state);
        }

        // Update readmitted patients (Bamboo)
        console.log("\n📊 STEP 3: Updating State...");
        console.log("  • Setting readmittedPatients:", allReadmitted.length, "patients");
        setReadmittedPatients(allReadmitted);

        // Update facility summaries for display
        console.log("  • Setting facilityReadmissionData:", allData.length, "summaries");
        setFacilityReadmissionData(allData);

        // Rolling 3-month Puzzle totals
        // Use ADT + Charge Capture calculation if available, otherwise fall back to facility summary
        console.log("\n📊 STEP 4: Computing Final Metrics...");
        let rollingPuzzlePatients: number;
        if (totalDischargedPuzzlePatients > 0) {
            rollingPuzzlePatients = totalDischargedPuzzlePatients;
            console.log("  ✅ Using ADT + Charge Capture for rollingPuzzlePatients:", rollingPuzzlePatients);
        } else {
            console.log("  ⚠️ No ADT/Charge Capture data - falling back to facility summary");
            rollingPuzzlePatients = allData.reduce((sum, row, idx) => {
                const count =
                    (row.ccm_master_count || 0) +
                    (row.ccm_master_discharged_count || 0) +
                    (row.non_ccm_master_count || 0);
                console.log(`     • Summary ${idx + 1}: ${count} patients (CCM: ${row.ccm_master_count || 0}, Discharged: ${row.ccm_master_discharged_count || 0}, Non-CCM: ${row.non_ccm_master_count || 0})`);
                return sum + count;
            }, 0);
            console.log("  📊 Fallback rollingPuzzlePatients:", rollingPuzzlePatients);
        }

        const rollingPuzzleReadmissions = allData.reduce((sum, row, idx) => {
            console.log(`     • Summary ${idx + 1} h30_admit:`, row.h30_admit || 0);
            return sum + (row.h30_admit || 0);
        }, 0);

        const rollingBambooReadmissions = allReadmitted.length;

        const totalReadmissions3mo = rollingBambooReadmissions;

        const rollingRate =
            rollingPuzzlePatients > 0
                ? (totalReadmissions3mo / rollingPuzzlePatients) * 100
                : 0;

        const endTime = performance.now();
        console.log("\n╔════════════════════════════════════════════════════════════════╗");
        console.log("║           FINAL METRICS SUMMARY                                ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log("  📊 Total Puzzle Continuity Care Patients Tracked:", rollingPuzzlePatients);
        console.log("  📊 30-Day Readmissions (Puzzle Patients):", totalReadmissions3mo);
        console.log("  📊 Rolling Readmission Rate:", rollingRate.toFixed(2) + "%");
        console.log("  ────────────────────────────────────────────────────");
        console.log("  📈 Breakdown:");
        console.log("     • Rolling Puzzle Readmissions (from summary):", rollingPuzzleReadmissions);
        console.log("     • Rolling Bamboo Readmissions:", rollingBambooReadmissions);
        console.log("     • Readmitted Patient Names:", allReadmitted.map(p => p.name).join(", ") || "None");
        console.log("  ────────────────────────────────────────────────────");
        console.log(`  ⏱️ Calculation completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log("╚════════════════════════════════════════════════════════════════╝\n");

        // Set metrics for UI
        setPatientMetrics({
            rollingPuzzlePatients,
            rollingPuzzleReadmissions,
            rollingBambooReadmissions,
            totalReadmissions3mo,
            rollingRate,
            facilityName: facilityStaticInfo?.name,
            publicLogoLink: facilityStaticInfo?.logo_url,

            executiveSummary: `This three-month performance review highlights Puzzle's sustained impact at ${facilityStaticInfo?.name}. Despite natural fluctuations in census, our coordinated clinical pathways continued to drive low avoidable hospital returns.`,

            closingStatement: `We appreciate the strong collaboration with ${facilityStaticInfo?.name}. Together, we have built consistency in processes that prevent unnecessary hospitalizations and improve resident outcomes.`,

            nationalReadmissionsBenchmark: Number(
                process.env.NEXT_PUBLIC_NATIONAL_READMISSION_BENCHMARK
            )
        });
        console.log("✅ Patient metrics state updated successfully");
    };

    // Fetch available patients when selection changes (but don't calculate metrics)
    useEffect(() => {
        const run = async () => {
            console.log("=== useEffect triggered (patient fetch only) ===");
            console.log("Inputs:", {
                selectedNursingHomeId,
                selectedNursingHomeName,
                selectedMonth,
                selectedYear
            });

            // Reset patient lists if required inputs are missing
            if (selectedNursingHomeId && selectedNursingHomeName && selectedMonth && selectedYear) {
                console.log("Fetching available patients...");
                await fetchAvailablePatients();
            } else {
                console.log("Missing inputs — clearing patient-related state.");
                setAvailablePatients([]);
                setSelectedCaseStudyPatients([]);
                setSelectedInterventionPatients([]);
                setSelectedNursingHomeName(null);
            }
        };

        run();
    }, [selectedNursingHomeId, selectedNursingHomeName, selectedMonth, selectedYear]);

    const fetchAvailablePatients = async () => {
        if (!selectedNursingHomeId) return

        setIsLoadingPatients(true)
        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
            const nextYear = monthNumber === 12 ? Number(selectedYear) + 1 : Number(selectedYear)
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

            const { data: patients, error } = await supabase
                .from("patients")
                .select("id, name, created_at")
                .eq("nursing_home_id", selectedNursingHomeId)
                .eq("month", selectedMonth)
                .eq("year", selectedYear)
                //.gte("created_at", startDate)
                //.lte("created_at", endDate)
                .order("name")

            if (error) throw error

            setAvailablePatients(patients || [])
            // Reset selections when nursing home changes
            setSelectedCaseStudyPatients([])
            setSelectedInterventionPatients([])
            setExpandedPatientId(null)
            setUseAISelection(false)
        } catch (error) {
            console.error("Error fetching patients:", error)
            toast({
                title: "Error",
                description: "Failed to fetch patients. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingPatients(false)
        }
    }

    const handlePatientToggle = (patientId: string) => {
        if (selectedPatientIds.includes(patientId)) {
            setSelectedCaseStudyPatients((prev) => prev.filter((id) => id !== patientId))
            setSelectedInterventionPatients((prev) => prev.filter((id) => id !== patientId))
            if (expandedPatientId === patientId) {
                setExpandedPatientId(null)
            }
        } else {
            setSelectedCaseStudyPatients((prev) => [...prev, patientId])
            setSelectedInterventionPatients((prev) => [...prev, patientId])
        }
    }

    const handleSelectAllPatients = () => {
        const allIds = availablePatients.map((p) => p.id)
        setSelectedCaseStudyPatients(allIds)
        setSelectedInterventionPatients(allIds)
    }

    const handleDeselectAllPatients = () => {
        setSelectedCaseStudyPatients([])
        setSelectedInterventionPatients([])
        setExpandedPatientId(null)
    }

    const handleCaseStudyAssignmentToggle = (patientId: string) => {
        setSelectedCaseStudyPatients((prev) => {
            const exists = prev.includes(patientId)
            if (exists && expandedPatientId === patientId) {
                setExpandedPatientId(null)
            }
            return exists ? prev.filter((id) => id !== patientId) : [...prev, patientId]
        })
    }

    const handleInterventionAssignmentToggle = (patientId: string) => {
        setSelectedInterventionPatients((prev) =>
            prev.includes(patientId) ? prev.filter((id) => id !== patientId) : [...prev, patientId],
        )
    }

    // Replace the existing fetchCaseStudies function with this updated version
    const fetchCaseStudies = async () => {
        if (!selectedNursingHomeId) return
        console.log("selectedNursingHomeId is ", selectedNursingHomeId)


        setIsLoadingCaseStudies(true)

        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
            const nextYear = monthNumber === 12 ? Number(selectedYear) + 1 : Number(selectedYear)
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

            // Use selected patients or all patients if none selected
            const patientIds =
                selectedPatientIds.length > 0 ? selectedPatientIds : availablePatients.map((p) => p.id)

            if (patientIds.length === 0) {
                setCaseStudies([])
                setIsLoadingCaseStudies(false)
                return
            }

            const { data: existingHighlights } = await supabase
                .from("patient_case_study_highlights")
                .select("patient_id")
                .in("patient_id", patientIds);

            const existingIds = new Set(existingHighlights?.map(h => h.patient_id) || []);
            const idsToGenerate = patientIds.filter(id => !existingIds.has(id));
            let buildRiskAndInterventionCategories = false

            console.log("Need to generate for ", idsToGenerate)
            await processPatientsWithLimit(idsToGenerate, 20);

            if (idsToGenerate && idsToGenerate.length > 0) {
                buildRiskAndInterventionCategories = true
            }


            // Get case studies for selected patients in the date range
            const { data, error } = await supabase
                .from("patient_case_study_highlights")
                .select(`
                    id,
                    patient_id,
                    hospital_discharge_summary_text,
                    highlight_text,
                    facility_summary_text,
                    engagement_summary_text,
                    facility_summary_quotes,
                    engagement_summary_quotes,
                    interventions,
                    outcomes,
                    clinical_risks,
                    highlight_quotes,
                    hospital_discharge_summary_quotes,
                    detailed_interventions,
                    detailed_outcomes,
                    detailed_clinical_risks,
                    created_at,
                    categorizedRisks,
                    categorizedInterventions
                `)
                .in("patient_id", patientIds)
                .order("created_at", { ascending: false })

            if (error) {
                throw error
            }

            // Format the case studies with patient names
            const formattedCaseStudies = data.map((cs) => {
                const patient = availablePatients.find((p) => p.id === cs.patient_id)
                return {
                    id: cs.id,
                    patient_id: cs.patient_id,
                    hospital_discharge_summary_text: cs.hospital_discharge_summary_text,
                    highlight_text: cs.highlight_text,
                    facility_summary_text: cs.facility_summary_text,
                    engagement_summary_text: cs.engagement_summary_text,
                    facility_summary_quotes: cs.facility_summary_quotes,
                    engagement_summary_quotes: cs.engagement_summary_quotes,
                    interventions: cs.interventions,
                    outcomes: cs.outcomes,
                    clinical_risks: cs.clinical_risks,
                    highlight_quotes: cs.highlight_quotes,
                    hospital_discharge_summary_quotes: cs.hospital_discharge_summary_quotes,
                    detailed_interventions: cs.detailed_interventions,
                    detailed_outcomes: cs.detailed_outcomes,
                    detailed_clinical_risks: cs.detailed_clinical_risks,
                    created_at: cs.created_at,
                    patient_name: patient?.name || "Unknown Patient",
                    categorizedInterventions: cs.categorizedInterventions,
                    categorizedRisks: cs.categorizedRisks
                }
            })

            setCaseStudies(formattedCaseStudies)

            console.log(`selectedNursingHomeId is `, selectedNursingHomeId)

            const facilityMappedName = facilityNameMap[selectedNursingHomeName!] || {
                originalName: selectedNursingHomeName,
                mappedName: selectedNursingHomeName
            }

            console.log("facilityMappedName ios ", facilityMappedName)

            console.log("buildRiskAndInterventionCategories is - ", buildRiskAndInterventionCategories)

            // Moving this to one
            if (buildRiskAndInterventionCategories) {
                console.log("buildRiskAndInterventionCategories is - ", buildRiskAndInterventionCategories)

                // Now categorize interventions
                const allInterventions = [
                    ...new Set(
                        formattedCaseStudies
                            .flatMap((cs) => cs.detailed_interventions || [])
                            .filter(Boolean)
                    ),
                ]
                console.log("BEfore categorization - allInterventions - ", allInterventions)

                if (allInterventions.length > 0) {
                    const parsedInterventions = allInterventions.map((item) =>
                        typeof item === 'string' ? JSON.parse(item) : item
                    )
                    console.log("BEfore categorization - Parsed Interventions - ", parsedInterventions)

                    const categorized = await categorizeInterventionsWithOpenAI(parsedInterventions)
                    console.log("After categorization - Catogorized Interventions - ", categorized)

                    if (categorized && typeof categorized === "object") {
                        const counts = Object.entries(categorized)
                            .map(([name, count]) => ({
                                name,
                                count: Number(count) || 0,
                            }))
                            .filter(item => item.count > 0) // ⬅️ filter out 0s
                            .sort((a, b) => b.count - a.count); // optional sorting
                        console.log("After Intervention categorization - Counts - ", counts)

                        setInterventionCounts(counts);

                        const formattedCaseStudies = data.map(async (cs) => {
                            // Update the categorized data into DB
                            const { error: updateError } = await supabase
                                .from("patient_case_study_highlights")
                                .update({
                                    categorizedInterventions: counts
                                })
                                .eq("patient_id", cs.patient_id)
                        });
                    } else {
                        console.warn("❗ Unexpected categorization response:", categorized);
                    }
                }

                const uniqueRisks = [
                    ...new Set(
                        formattedCaseStudies
                            .flatMap(study => study.clinical_risks || [])
                            .map((item) => {
                                try {
                                    const parsed = typeof item === "string" ? JSON.parse(item) : item
                                    return parsed.risk?.trim()
                                } catch {
                                    return null
                                }
                            })
                            .filter(Boolean)
                    )
                ];
                console.log("BEfore categorization - uniqueRisks - ", uniqueRisks)

                const categorizedRisks = await categorizeClinicalRisksWithOpenAI(uniqueRisks)
                console.log("After categorization - Catogorized Risks - ", categorizedRisks)

                if (categorizedRisks && typeof categorizedRisks === "object") {
                    const counts = Object.entries(categorizedRisks)
                        .map(([risk, count]) => ({
                            risk,
                            count: Number(count) || 0,
                        }))
                        .filter(item => item.count > 0) // ⬅️ filter out 0s
                        .sort((a, b) => b.count - a.count); // optional sorting
                    console.log("After RISK categorization - Counts - ", counts)

                    setClinicalRisks(counts);

                    const formattedCaseStudies = data.map(async (cs) => {
                        // Update the categorized data into DB
                        const { error: updateError } = await supabase
                            .from("patient_case_study_highlights")
                            .update({
                                categorizedRisks: counts
                            })
                            .eq("patient_id", cs.patient_id)
                    });

                } else {
                    console.warn("❗ Unexpected categorization response:", categorizedRisks);
                }
            } else {
                const formattedCaseStudies = data.map(async (cs) => {
                    setClinicalRisks(Array.isArray(cs.categorizedRisks) ? cs.categorizedRisks : []);
                    setInterventionCounts(Array.isArray(cs.categorizedInterventions) ? cs.categorizedInterventions : []);
                });
            }
        } catch (error: any) {
            console.error("Error fetching case studies:", error?.message || error || "Unknown error")

            toast({
                title: "Error",
                description: "Failed to fetch case studies. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingCaseStudies(false)
        }
    }

    const handleGenerateReport = async () => {
        const reportStartTime = performance.now()
        console.log("\n")
        console.log("╔════════════════════════════════════════════════════════════════╗")
        console.log("║           🚀 GENERATE REPORT STARTED                           ║")
        console.log("╚════════════════════════════════════════════════════════════════╝")
        console.log(`[${new Date().toISOString()}] handleGenerateReport triggered`)
        console.log("📋 Report Parameters:")
        console.log("  • Nursing Home ID:", selectedNursingHomeId)
        console.log("  • Nursing Home Name:", selectedNursingHomeName)
        console.log("  • Month:", selectedMonth)
        console.log("  • Year:", selectedYear)
        console.log("  • Selected Case Study Patients:", selectedCaseStudyPatients.length)
        console.log("  • Selected Intervention Patients:", selectedInterventionPatients.length)

        setIsGenerating(true)
        setReportGenerated(false)
        try {
            // STEP 1: Calculate metrics (Total Puzzle Continuity Care Patients, 30-Day Readmissions)
            console.log("\n🔄 STEP 1/2: Calculating Metrics...")
            const metricsStartTime = performance.now()
            await calculateMetrics()
            const metricsEndTime = performance.now()
            console.log(`✅ Metrics calculation completed in ${(metricsEndTime - metricsStartTime).toFixed(2)}ms`)

            // STEP 2: Fetch case studies
            console.log("\n🔄 STEP 2/2: Fetching Case Studies...")
            const caseStudiesStartTime = performance.now()
            await fetchCaseStudies()
            const caseStudiesEndTime = performance.now()
            console.log(`✅ Case studies fetched in ${(caseStudiesEndTime - caseStudiesStartTime).toFixed(2)}ms`)

            setReportGenerated(true)

            const reportEndTime = performance.now()
            console.log("\n╔════════════════════════════════════════════════════════════════╗")
            console.log("║           ✅ REPORT GENERATION COMPLETE                        ║")
            console.log("╚════════════════════════════════════════════════════════════════╝")
            console.log(`  ⏱️ Total report generation time: ${(reportEndTime - reportStartTime).toFixed(2)}ms`)
            console.log("  📊 Metrics:", {
                puzzlePatients: patientMetrics.rollingPuzzlePatients,
                readmissions: patientMetrics.totalReadmissions3mo,
                rate: patientMetrics.rollingRate?.toFixed(2) + "%"
            })
            console.log("\n")

            toast({
                title: "Report Generated",
                description: "The report has been generated successfully.",
            })
        } catch (error: any) {
            console.error("\n╔════════════════════════════════════════════════════════════════╗")
            console.error("║           ❌ REPORT GENERATION FAILED                          ║")
            console.error("╚════════════════════════════════════════════════════════════════╝")
            console.error("Error details:", error)
            console.error("Error message:", error?.message || "Unknown error")
            console.error("Error stack:", error?.stack)
            toast({
                title: "Error",
                description: "Failed to generate report. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsGenerating(false)
            console.log("🏁 Report generation process finished (isGenerating set to false)")
        }
    }

    const handlePrint = useCallback(async (patientMetrics: any) => {
        try {

            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            setIsPrinting(true)

            console.log("categorizedInterventions are ", categorizedInterventions)

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies)
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries)
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries)
            const privacySafeReadmittedPatients = readmittedPatients.map(patient => ({
                ...patient,
                name: formatPatientName(patient.name)
            }))

            // Use the exportToPDF function to generate a PDF blob
            const result = await exportToPDF({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies: privacySafeCaseStudies,
                caseStudyHighlights: privacySafeCaseStudyEntries,
                interventionStudies: privacySafeInterventionEntries,
                patientMetrics,
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                expandedPatientId,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                returnBlob: true,
                interventionCounts: safeInterventionCounts,
                totalInterventions: totalInterventions,
                clinicalRisks: clinicalRisks,
                readmittedPatients: privacySafeReadmittedPatients
            })

            if (!result || !(result instanceof Blob)) {
                throw new Error('Failed to generate PDF blob');
            }

            // Create a URL for the blob
            const pdfUrl = URL.createObjectURL(result)

            // Open PDF in new window
            const printWindow = window.open(pdfUrl, '_blank')
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print()
                    // Clean up the blob URL after printing
                    URL.revokeObjectURL(pdfUrl)
                }
            }
        } catch (error) {
            console.error('Error generating print PDF:', error)
            toast({
                title: "Error",
                description: "Failed to prepare document for printing.",
                variant: "destructive",
            })
        } finally {
            setIsPrinting(false)
        }
    }, [
        nursingHomes,
        selectedNursingHomeId,
        selectedMonth,
        selectedYear,
        caseStudies,
        caseStudyEntries,
        interventionEntries,
        categorizedInterventions,
        safeInterventionCounts,
        clinicalRisks,
        patientMetrics,
        toast,
        applyPatientPrivacy,
    ])

    const handleExportPDF = async (patientMetrics: any) => {

        try {
            setIsExporting(true)
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies)
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries)
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries)
            const privacySafeReadmittedPatients = readmittedPatients.map(patient => ({
                ...patient,
                name: formatPatientName(patient.name)
            }))

            // Use the exportToPDF function from export-utils
            await exportToPDF({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies: privacySafeCaseStudies,
                caseStudyHighlights: privacySafeCaseStudyEntries,
                interventionStudies: privacySafeInterventionEntries,
                patientMetrics,
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                expandedPatientId,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                interventionCounts: safeInterventionCounts,
                totalInterventions: totalInterventions,
                clinicalRisks: clinicalRisks,
                readmittedPatients: privacySafeReadmittedPatients
            })

            toast({
                title: "Success",
                description: "Report exported as PDF successfully.",
            })
        } catch (error) {
            console.error('Error exporting PDF:', error)
            toast({
                title: "Error",
                description: "Failed to export report as PDF.",
                variant: "destructive",
            })
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportDOCX = async (patientMetrics: any) => {

        try {
            setIsExporting(true);
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId);

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found');
            }

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies);
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries);
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries);

            toast({
                title: "Success",
                description: "Report exported as DOCX successfully.",
            });
        } catch (error) {
            console.error('Error exporting DOCX:', error);
            toast({
                title: "Error",
                description: "Failed to export report as DOCX.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const formatDate = (date: Date): string => {
        return dateformat(date, "PPP")
    }

    async function categorizeClinicalRisksWithOpenAI(risks: string[]) {
        const prompt = `
Below is a list of clinical risks observed in nursing home patients. 
Your task is to classify them into a small number (5 to 7) of clear, medically meaningful categories (e.g. Fall Risk, Chronic Condition Complications, Readmission Risk, etc.). 
Return the result as a JSON object with category names as keys and counts as values."

Here is the Sample response: 
{
  "Fall Risk (e.g., fractures)": 10,
  "Chronic Condition Complications": 7,
  "Readmission Risk": 5,
  "Congestive Heart Failure: 8,
  "Chronic Kidney Disease": 67,
  "Cognitive Impairment": 13
}

DO NOT return anything else.

Clinical Risks:
${JSON.stringify(risks, null, 2)}
`;

        const response = await fetch("/api/openai-categorize", {
            method: "POST",
            body: JSON.stringify({ prompt }),
            headers: { "Content-Type": "application/json" },
        });

        const json = await response.json();
        return json;
    }


    async function categorizeInterventionsWithOpenAI(interventions: string[]) {
        // Parse stringified JSON items into objects
        const parsed = interventions.map((item) =>
            typeof item === "string" ? JSON.parse(item) : item
        )

        console.log("parsed interventions are ", parsed)

        const prompt = `
You are a healthcare analyst. Your job is to classify a list of healthcare intervention descriptions into a small number of standardized categories.
Use only the following categories unless absolutely necessary:
- Care Coordination
- Medication Management
- Therapy & Rehabilitation
- Transitional Support
- Patient Engagement & Education
- Clinical Risk Management
- Behavioral & Psychosocial Support
- Nutrition & Functional Recovery

Group similar interventions under the most relevant high-level category. Avoid creating new categories unless none of the above fit.
Return the result as a JSON object with category names as keys and counts as values."
{
  "Medication reconciliations": 16,
  "Transitional Support": 10,
  "Clinical Risk Management": 2,
  "Engagement & Education": 5,
  "Care Navigation": 6,
  "Rehabilitation & Mobility Support": 20,
  "Behavioral & Psychosocial Support": 23,
  "Nutrition & Functional Recovery": 12
  ...
  ...
}
Do NOT include quotes or file IDs.

Here is the list:
${JSON.stringify(parsed, null, 2)}
`;

        const response = await fetch("/api/openai-categorize", {
            method: "POST",
            body: JSON.stringify({ prompt }),
            headers: { "Content-Type": "application/json" },
        });
        const json = await response.json();


        console.log("🧠 Sub-categorization response JSON:", json);
        return json;
    }

    const getPatientInitials = (name: string): string => {
        const nameParts = name.split(" ")
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join("")
        return initials
    }

    // Prepare data for the readmissions pie chart
    const readmissionChartData = [
        {
            name: "Successful Transitions",
            value: (
                patientMetrics.rollingPuzzlePatients -
                patientMetrics.rollingBambooReadmissions
            ),
            color: "#4ade80", // green
        },
        {
            name: "30-Day Readmissions",
            value: (
                patientMetrics.rollingBambooReadmissions
            ),
            color: "#facc15", // yellow
        }
    ]


    // Calculate total interventions for the touchpoints section
    const totalInterventions = safeInterventionCounts.reduce((sum, item) => sum + item.count, 0)

    //const COLORS = ["#4ade80", "#f87171"] // Green for success, red for readmissions
    const COLORS = [
        "#4ade80", // Successful
        "#facc15" // 30-Day
    ]

    const INTERVENTION_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24"] // Blue, green, purple, yellow
    const RISK_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16"] // Red, orange, yellow, green

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Generate Report</CardTitle>
                    <CardDescription>Select the nursing home, month, and year to generate a report.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="nursing-home">Nursing Home</Label>

                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between"
                                    >
                                        {selectedNursingHomeName || "Select a nursing home"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command
                                        filter={(value, search) => {
                                            // Force strict substring match (case-insensitive)
                                            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                        }}

                                    >
                                        <CommandInput placeholder="Search nursing home..." />
                                        <CommandList>
                                            <CommandEmpty>No nursing homes found.</CommandEmpty>
                                            <CommandGroup>
                                                {[...nursingHomes]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((home) => (
                                                        <CommandItem
                                                            key={home.id}
                                                            value={home.name}
                                                            onSelect={() => {
                                                                setSelectedNursingHomeId(home.id)
                                                                setSelectedNursingHomeName(home.name)
                                                                setOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    home.id === selectedNursingHomeId
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {home.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <Label htmlFor="month">Month</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((month) => (
                                        <SelectItem key={month} value={month}>
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="year">Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {selectedNursingHomeId && (
                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium">Patient Selection</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Choose specific patients for this report or use AI to auto-select relevant patients.
                                    </p>
                                </div>
                            </div>

                            {isLoadingPatients ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : availablePatients.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Case Studies: {selectedCaseStudyPatients.length} • Key Interventions: {selectedInterventionPatients.length}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSelectAllPatients}
                                                disabled={
                                                    selectedCaseStudyPatients.length === availablePatients.length &&
                                                    selectedInterventionPatients.length === availablePatients.length
                                                }
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleDeselectAllPatients}
                                                disabled={selectedPatientIds.length === 0}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                    </div>

                                    {useAISelection && isAISelecting && (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            <span className="text-sm">AI is selecting relevant patients...</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                        {availablePatients.map((patient) => {
                                            const isSelected = selectedPatientIds.includes(patient.id)
                                            const inCaseStudies = selectedCaseStudyPatients.includes(patient.id)
                                            const inInterventions = selectedInterventionPatients.includes(patient.id)

                                            return (
                                                <div
                                                    key={patient.id}
                                                    className="flex flex-col p-2 rounded border bg-white hover:bg-slate-50"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`patient-${patient.id}`}
                                                            checked={isSelected}
                                                            onChange={() => handlePatientToggle(patient.id)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <Label htmlFor={`patient-${patient.id}`} className="text-sm cursor-pointer flex-1 truncate">
                                                            {patient.name}
                                                        </Label>
                                                    </div>

                                                    {isSelected && (
                                                        <>
                                                            <div className="flex flex-wrap items-center gap-4 pl-6 pt-2 text-xs text-muted-foreground">
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`patient-${patient.id}-case`}
                                                                        checked={inCaseStudies}
                                                                        onChange={() => handleCaseStudyAssignmentToggle(patient.id)}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                    Case Studies
                                                                </label>
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`patient-${patient.id}-interventions`}
                                                                        checked={inInterventions}
                                                                        onChange={() => handleInterventionAssignmentToggle(patient.id)}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                    Key Interventions
                                                                </label>
                                                            </div>

                                                            {inCaseStudies && (
                                                                <div className="flex items-center pl-6 pt-1">
                                                                    <input
                                                                        type="radio"
                                                                        id={`expanded-${patient.id}`}
                                                                        name="expandedPatient"
                                                                        checked={expandedPatientId === patient.id}
                                                                        onChange={() => setExpandedPatientId(patient.id)}
                                                                        className="mr-2"
                                                                    />
                                                                    <Label htmlFor={`expanded-${patient.id}`} className="text-xs text-muted-foreground">
                                                                        Mark as Expanded Summary Patient
                                                                    </Label>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No patients found for this nursing home.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex w-full flex-col gap-3 md:w-auto">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="patient-phi-toggle"
                                    checked={showPatientPHI}
                                    onCheckedChange={setShowPatientPHI}
                                    aria-label="Toggle patient PHI visibility"
                                />
                                <div className="space-y-0.5">
                                    <Label htmlFor="patient-phi-toggle" className="text-sm font-medium leading-none">
                                        Patient PHI visibility
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {showPatientPHI ? "Show" : "Hide"} patient last names in this report.
                                    </p>
                                </div>
                            </div>
                        </div>
                        {caseStudies.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Found {caseStudies.length} case studies for your selections.
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleGenerateReport}
                        disabled={
                            !selectedNursingHomeId || isGenerating || (availablePatients.length > 0 && selectedPatientIds.length === 0)
                        }
                        className="min-w-[150px]"
                    >
                        {isGenerating ? (
                            <>
                                Generating <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            </>
                        ) : (
                            "Generate Report"
                        )}
                    </Button>
                </CardFooter>
            </Card>

            {/* Report Preview */}
            {reportGenerated && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle>Report Preview</CardTitle>
                            <CardDescription>A preview of the generated report.</CardDescription>
                            {selectedPatientIds.length > 0 && selectedPatientIds.length < availablePatients.length && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Report includes {selectedPatientIds.length} selected patients
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm"
                                onClick={() => handlePrint(patientMetrics)} // <- passing explicitly
                                disabled={isGenerating || isPrinting}>
                                <PrinterIcon className={`h-4 w-4 mr-2`} />
                                {isPrinting ? "Preparing..." : "Print"}
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={isExporting}>
                                        <FileDownIcon className="h-4 w-4 mr-2" />
                                        {isExporting ? (
                                            <>
                                                Exporting <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                            </>
                                        ) : (
                                            "Export"
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="border border-border shadow-md p-1 rounded-md">
                                    <DropdownMenuItem
                                        onClick={() => handleExportPDF(patientMetrics)} // <- passing explicitly

                                    >
                                        <FileTextIcon className="h-4 w-4 mr-2" />
                                        Export as PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Tabs defaultValue="preview" className="w-full space-y-4">
                            <TabsContent value="preview" className="space-y-4">
                                <div className="space-y-6" >
                                    {/* Patient Snapshot Overview with Pie Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                            Patient Snapshot Overview: 30-Day Readmissions
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={readmissionsChartRef}>
                                            {/* Pie Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        successful: {
                                                            label: "Successful Transitions",
                                                            color: "#4ade80",
                                                        },
                                                        readmissions: {
                                                            label: "30-Day Readmissions (Puzzle Patients)",
                                                            color: "#f87171",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={readmissionChartData}
                                                                cx="50%"
                                                                cy="50%"
                                                                labelLine={false}
                                                                outerRadius={100}
                                                                fill="#8884d8"
                                                                dataKey="value"
                                                                nameKey="name"
                                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                                            >
                                                                {readmissionChartData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip content={<ChartTooltipContent />} />
                                                            <Legend />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Metrics Table */}
                                            <div className="flex flex-col justify-center">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Metric
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Count
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Percentage
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                Total Puzzle Continuity Care Patients Tracked
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.rollingPuzzlePatients}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">-</td>
                                                        </tr>

                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">30-Day Readmissions (Puzzle Patients)</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.rollingBambooReadmissions}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.rollingRate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Re-Admitted Patients Table - Separate Section */}
                                    {readmittedPatients.length > 0 && (
                                        <div className="border rounded-lg p-6 bg-white">
                                            <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                                30-Day Re-Admitted Patients
                                            </h2>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Patient Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Discharge Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                SNF Discharge Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Readmission Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Readmission Reason
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {readmittedPatients.map((patient, index) => (
                                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {formatPatientName(patient.name)}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.hospitalDischargeDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.snfDischargeDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.hospitalReadmitDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                                    {patient.hospitalName}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                                    {patient.readmissionReason}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    {/* Puzzle's Touchpoints with Bar Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">Puzzle's Touchpoints</h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={touchpointsChartRef}>
                                            {/* Bar Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        interventions: {
                                                            label: "Interventions",
                                                            color: "#60a5fa",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={safeInterventionCounts}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="Count">
                                                                {safeInterventionCounts.map((entry, index) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={INTERVENTION_COLORS[index % INTERVENTION_COLORS.length]}
                                                                    />
                                                                ))}
                                                                <LabelList dataKey="count" position="right" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Summary */}
                                            <div className="flex flex-col justify-center">
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <div className="text-lg font-semibold mb-3">
                                                        Total Interventions Delivered: {totalInterventions}
                                                    </div>
                                                    <ul className="text-sm space-y-2">
                                                        {safeInterventionCounts.map((item, index) => (
                                                            <li key={index} className="flex items-center">
                                                                <span
                                                                    className="w-3 h-3 rounded-full mr-2"
                                                                    style={{ backgroundColor: INTERVENTION_COLORS[index % INTERVENTION_COLORS.length] }}
                                                                ></span>
                                                                {item.count} {item.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Clinical Risks with Horizontal Bar Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                            Top Clinical Risks Identified at Discharge
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={clinicalRisksChartRef}>
                                            {/* Horizontal Bar Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        patients: {
                                                            label: "Count across Patients",
                                                            color: "#ef4444",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={clinicalRisks}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="risk" type="category" width={180} tick={{ fontSize: 12 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="Count across Patients">
                                                                {clinicalRisks.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="count" position="right" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Table */}
                                            <div className="flex flex-col justify-center">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Clinical Risk
                                                            </th>
                                                            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 tracking-wider">
                                                                Count across Patients
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {clinicalRisks.map((risk, index) => (
                                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                <td className="px-4 py-3 text-sm text-gray-900 flex items-center">
                                                                    <span
                                                                        className="w-3 h-3 rounded-full mr-2"
                                                                        style={{ backgroundColor: RISK_COLORS[index % RISK_COLORS.length] }}
                                                                    ></span>
                                                                    {risk.risk}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">{risk.count}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg p-6 bg-white">
                                        <h3 className="text-xl font-semibold text-blue-800 mb-4">
                                            Puzzle's Key Interventions and Outcomes for Patients
                                        </h3>

                                        {interventionEntries.length > 0 ? interventionEntries.map((study) => {
                                            const shortName = formatPatientName(study.patient_name)

                                            return (
                                                <div key={study.id} className="mb-6">
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <p className="text-sm font-semibold text-gray-800">{shortName}</p>
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(study)}>
                                                            Edit
                                                        </Button>
                                                    </div>

                                                    {/* Interventions */}
                                                    {(study.detailed_interventions || []).length > 0 && (
                                                        <>
                                                            <p className="text-sm font-medium text-gray-700 mb-1">Interventions:</p>
                                                            <ul className="list-disc list-inside pl-4 text-sm text-gray-700 space-y-1 mb-3">
                                                                {study.detailed_interventions.map((item, idx) => (
                                                                    <li key={`int-${idx}`}>
                                                                        {item.intervention}
                                                                        {item.source_quote && (
                                                                            <p className="text-xs text-gray-500 italic mt-1 pl-2">
                                                                                “{item.source_quote}”
                                                                                {item.source_file_id && (
                                                                                    <>
                                                                                        {" — "}
                                                                                        <a
                                                                                            href={`/api/download-file?id=${item.source_file_id}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 underline"
                                                                                        >
                                                                                            Download Source
                                                                                        </a>
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}

                                                    {/* Outcomes */}
                                                    {(study.detailed_outcomes || []).length > 0 && (
                                                        <>
                                                            <p className="text-sm font-medium text-gray-700 mb-1">Outcomes:</p>
                                                            <ul className="list-disc list-inside pl-4 text-sm text-gray-700 space-y-1">
                                                                {study.detailed_outcomes.map((item, idx) => (
                                                                    <li key={`out-${idx}`}>
                                                                        {item.outcome}
                                                                        {item.source_quote && (
                                                                            <p className="text-xs text-gray-500 italic mt-1 pl-2">
                                                                                “{item.source_quote}”
                                                                                {item.source_file_id && (
                                                                                    <>
                                                                                        {" — "}
                                                                                        <a
                                                                                            href={`/api/download-file?id=${item.source_file_id}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 underline"
                                                                                        >
                                                                                            Download Source
                                                                                        </a>
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                {selectedInterventionPatients.length === 0
                                                    ? "No patients have been assigned to the Key Interventions section."
                                                    : "No intervention details available for the selected patients."}
                                            </div>
                                        )}
                                    </div>

                                    {/* Case Studies */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h3 className="text-xl font-semibold text-blue-800 mb-4">Case Study Highlights</h3>
                                        {caseStudyEntries.length > 0 ? (
                                            caseStudyEntries.map((study) => {
                                                const shortName = formatPatientName(study.patient_name)

                                                return (
                                                    <div key={study.id} className="border-l-4 border-blue-500 pl-4 py-2 mb-4">
                                                        <div className="mb-2 flex items-start justify-between gap-3">
                                                            <p className="text-sm font-medium">{shortName}</p>
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(study)}>
                                                                Edit
                                                            </Button>
                                                        </div>
                                                        <p className="text-sm font-medium">
                                                            {study.hospital_discharge_summary_text
                                                                ? study.hospital_discharge_summary_text.charAt(0).toUpperCase() +
                                                                study.hospital_discharge_summary_text.slice(1)
                                                                : ""}
                                                        </p>

                                                        <Citations label="Cited from" quotes={study.hospital_discharge_summary_quotes || []} />

                                                        <p className="text-sm mt-4">
                                                            {study.facility_summary_text
                                                                ? study.facility_summary_text.charAt(0).toUpperCase() + study.facility_summary_text.slice(1)
                                                                : ""}
                                                        </p>
                                                        <Citations label="Cited from" quotes={study.facility_summary_quotes || []} />

                                                        <p className="text-sm mt-4">
                                                            {study.engagement_summary_text
                                                                ? study.engagement_summary_text.charAt(0).toUpperCase() + study.engagement_summary_text.slice(1)
                                                                : ""}
                                                        </p>
                                                        <Citations label="Cited from" quotes={study.engagement_summary_quotes || []} />
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                {selectedCaseStudyPatients.length === 0
                                                    ? "No patients have been assigned to the Case Studies section."
                                                    : "No case studies found for the selected patients."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open && !isSavingStudy) {
                        handleCloseEditDialog()
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit report content</DialogTitle>
                        <DialogDescription>
                            Adjust AI-generated summaries and interventions. Saved changes persist for future reports.
                        </DialogDescription>
                    </DialogHeader>

                    {editedStudy ? (
                        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Patient</Label>
                                <p className="text-sm font-medium text-slate-800">
                                    {formatPatientName(editedStudy.patient_name)}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="highlight-text" className="text-sm font-medium">
                                    Key Highlight
                                </Label>
                                <Textarea
                                    id="highlight-text"
                                    value={editedStudy.highlight_text || ""}
                                    onChange={(event) => handleEditedFieldChange("highlight_text", event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="discharge-summary" className="text-sm font-medium">
                                    Hospital Discharge Summary
                                </Label>
                                <Textarea
                                    id="discharge-summary"
                                    value={editedStudy.hospital_discharge_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("hospital_discharge_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="facility-summary" className="text-sm font-medium">
                                    Facility Summary
                                </Label>
                                <Textarea
                                    id="facility-summary"
                                    value={editedStudy.facility_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("facility_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="engagement-summary" className="text-sm font-medium">
                                    Engagement Summary
                                </Label>
                                <Textarea
                                    id="engagement-summary"
                                    value={editedStudy.engagement_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("engagement_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Interventions</h4>
                                {Array.isArray(editedStudy.detailed_interventions) &&
                                    editedStudy.detailed_interventions.length > 0 ? (
                                    editedStudy.detailed_interventions.map((item: any, index: number) => (
                                        <div key={`edit-int-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">
                                                Intervention {index + 1}
                                            </Label>
                                            <Textarea
                                                value={item?.intervention || ""}
                                                onChange={(event) =>
                                                    handleDetailedEntryChange(
                                                        "detailed_interventions",
                                                        index,
                                                        "intervention",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">No intervention details available.</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Outcomes</h4>
                                {Array.isArray(editedStudy.detailed_outcomes) &&
                                    editedStudy.detailed_outcomes.length > 0 ? (
                                    editedStudy.detailed_outcomes.map((item: any, index: number) => (
                                        <div key={`edit-out-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">
                                                Outcome {index + 1}
                                            </Label>
                                            <Textarea
                                                value={item?.outcome || ""}
                                                onChange={(event) =>
                                                    handleDetailedEntryChange(
                                                        "detailed_outcomes",
                                                        index,
                                                        "outcome",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">No outcome details available.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Select a patient case to edit.</p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSavingStudy}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEditedStudy} disabled={isSavingStudy}>
                            {isSavingStudy ? (
                                <>
                                    Saving
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                </>
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
