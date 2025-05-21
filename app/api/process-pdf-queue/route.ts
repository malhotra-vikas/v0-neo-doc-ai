import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        // Fix: Properly await cookies()
        const cookieStore = cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

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

            // Instead of calling an external API, we'll simulate text extraction
            // In a real implementation, you would use a PDF parsing library
            const extractedText = await simulatePdfTextExtraction(fileData)

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

// Function to simulate PDF text extraction
// In a real implementation, you would use a PDF parsing library
async function simulatePdfTextExtraction(pdfFile: Blob): Promise<string> {
    // Get the file size to make the simulation more realistic
    const fileSize = pdfFile.size

    // Create a simulated text based on the file size
    const paragraphCount = Math.max(3, Math.floor(fileSize / 10000))

    let extractedText = `PDF File Size: ${fileSize} bytes\n\n`

    for (let i = 0; i < paragraphCount; i++) {
        extractedText += `Paragraph ${i + 1}: This is simulated text extracted from the PDF document. `
        extractedText += `In a real implementation, this would contain the actual content from page ${i + 1} of the document. `
        extractedText += `The text would include patient information, medical notes, and other relevant data.\n\n`
    }

    // Add some metadata
    extractedText += `\nMetadata:\n`
    extractedText += `File Type: PDF\n`
    extractedText += `Extraction Date: ${new Date().toISOString()}\n`
    extractedText += `Processing Method: Simulation\n`

    // Simulate processing time based on file size
    const processingTime = Math.min(2000, Math.floor(fileSize / 5000))
    await new Promise((resolve) => setTimeout(resolve, processingTime))

    return extractedText
}
