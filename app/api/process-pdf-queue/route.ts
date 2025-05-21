import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })

        // Get the next pending item from the queue
        const { data: queueItem, error: queueError } = await supabase
            .from("pdf_processing_queue")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(1)
            .single()

        if (queueError || !queueItem) {
            return NextResponse.json(
                {
                    message: "No pending items in queue",
                    error: queueError?.message,
                },
                { status: 404 },
            )
        }

        // Update the queue item status to processing
        await supabase.from("pdf_processing_queue").update({ status: "processing" }).eq("id", queueItem.id)

        try {
            // Download the PDF file
            const { data: fileData, error: downloadError } = await supabase.storage
                .from("nursing-home-files")
                .download(queueItem.file_path)

            if (downloadError) {
                throw downloadError
            }

            // Call the PDF to text API service
            // This is a placeholder - you would replace this with your actual PDF to text API
            const formData = new FormData()
            formData.append("file", fileData)

            // Example API call to a PDF extraction service
            const response = await fetch("https://your-pdf-extraction-api.com/extract", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`)
            }

            const extractionResult = await response.json()
            const extractedText = extractionResult.text || "No text extracted"

            // Update the patient_files table with the extracted text
            await supabase
                .from("patient_files")
                .update({
                    parsed_text: extractedText,
                    processing_status: "completed",
                })
                .eq("id", queueItem.file_id)

            // Update the queue item status to completed
            await supabase
                .from("pdf_processing_queue")
                .update({
                    status: "completed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", queueItem.id)

            return NextResponse.json({
                message: "PDF processed successfully",
                file_id: queueItem.file_id,
            })
        } catch (error: any) {
            console.error("Error processing PDF:", error)

            // Update the queue item status to failed
            await supabase
                .from("pdf_processing_queue")
                .update({
                    status: "failed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", queueItem.id)

            // Update the patient_files status
            await supabase.from("patient_files").update({ processing_status: "failed" }).eq("id", queueItem.file_id)

            return NextResponse.json(
                {
                    message: "Failed to process PDF",
                    error: error.message,
                },
                { status: 500 },
            )
        }
    } catch (error: any) {
        console.error("Route handler error:", error)
        return NextResponse.json(
            {
                message: "Internal server error",
                error: error.message,
            },
            { status: 500 },
        )
    }
}
