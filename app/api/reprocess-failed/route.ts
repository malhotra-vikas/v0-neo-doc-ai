import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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
        const { fileIds, all } = body

        let filesToProcess: { id: string; file_path: string }[] = []

        if (all) {
            // Get all files with failed extraction using pagination
            const BATCH_SIZE = 1000
            let allFiles: { id: string; file_path: string }[] = []
            let hasMore = true
            let offset = 0

            while (hasMore) {
                const { data: batch, error: batchError } = await supabase
                    .from("patient_files")
                    .select("id, file_path")
                    .ilike("parsed_text", "%Python extraction failed%")
                    .range(offset, offset + BATCH_SIZE - 1)

                if (batchError) {
                    console.error("Error fetching failed files batch:", batchError)
                    break
                }

                if (batch && batch.length > 0) {
                    allFiles = [...allFiles, ...batch]
                    offset += BATCH_SIZE
                    hasMore = batch.length === BATCH_SIZE
                } else {
                    hasMore = false
                }
            }

            filesToProcess = allFiles
        } else if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
            // Get specific files
            const { data: files, error } = await supabase
                .from("patient_files")
                .select("id, file_path")
                .in("id", fileIds)

            if (error) {
                console.error("Error fetching files:", error)
                return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 })
            }

            filesToProcess = files || []
        } else {
            return NextResponse.json({ error: "No files specified" }, { status: 400 })
        }

        if (filesToProcess.length === 0) {
            return NextResponse.json({ count: 0, message: "No files to process" })
        }

        // Log the file IDs being processed
        console.log("=== REPROCESS FILES ===")
        console.log("Total files to reprocess:", filesToProcess.length)
        console.log("File IDs:", filesToProcess.map((f) => f.id))
        console.log("=== END REPROCESS FILES ===")

        // Update all files to pending status
        const fileIdsToProcess = filesToProcess.map((f) => f.id)

        const { error: updateError } = await supabase
            .from("patient_files")
            .update({ processing_status: "pending" })
            .in("id", fileIdsToProcess)

        if (updateError) {
            console.error("Error updating file statuses:", updateError)
            return NextResponse.json({ error: "Failed to update file statuses" }, { status: 500 })
        }

        // For each file, add or update queue entry
        for (const file of filesToProcess) {
            // Check for existing queue item
            const { data: existingItem } = await supabase
                .from("pdf_processing_queue")
                .select("id")
                .eq("file_id", file.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .single()

            if (existingItem) {
                // Update existing queue item
                await supabase
                    .from("pdf_processing_queue")
                    .update({ status: "pending", processed_at: null })
                    .eq("id", existingItem.id)
            } else {
                // Create new queue item
                await supabase
                    .from("pdf_processing_queue")
                    .insert([{ file_id: file.id, file_path: file.file_path, status: "pending" }])
            }
        }

        // Trigger processing (don't await - let it run in background)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/process-pdf-queue`, {
            method: "GET",
        }).catch(console.error)

        return NextResponse.json({
            count: filesToProcess.length,
            message: `${filesToProcess.length} files queued for reprocessing`,
        })
    } catch (error: any) {
        console.error("Error in reprocess-failed:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}
