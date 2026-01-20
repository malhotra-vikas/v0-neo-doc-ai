import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { processPatientsWithLimit } from "@/app/actions/generate-case-study"

export const maxDuration = 300 // 5 minutes timeout

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

        // Check authentication
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { patientIds } = body

        if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
            return NextResponse.json({ error: "No patient IDs provided" }, { status: 400 })
        }

        // Limit to 50 patients at a time to avoid timeout
        const idsToProcess = patientIds.slice(0, 50)

        console.log("=== REGENERATE CASE STUDIES ===")
        console.log(`Total patient IDs requested: ${patientIds.length}`)
        console.log(`Processing (limited to 50): ${idsToProcess.length}`)
        console.log("Patient IDs to process:", idsToProcess)
        console.log("=== END REGENERATE CASE STUDIES ===")

        // Process patients with rate limiting (20 concurrent)
        const results = await processPatientsWithLimit(idsToProcess, 20)

        const successCount = results.filter((r: any) => r?.success).length
        const failedCount = results.filter((r: any) => !r?.success).length

        console.log(`Case study regeneration complete: ${successCount} succeeded, ${failedCount} failed`)

        return NextResponse.json({
            count: idsToProcess.length,
            success: successCount,
            failed: failedCount,
            message: `Processed ${successCount} patients successfully, ${failedCount} failed`,
        })
    } catch (error: any) {
        console.error("Error in regenerate-case-studies:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}
