import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { extractTextFromPDF, getPDFMetadata } from "@/lib/pdf-utils"
import { logger } from "@/lib/logger"
import { logServerAuditEvent } from "@/lib/audit-logger"
import { generateCaseStudyHighlight } from "@/app/actions/generate-case-study"

const COMPONENT = "ProcessPDFQueue"

export const dynamic = "force-dynamic"
// Increase the maximum duration for this route handler to handle larger PDFs
export const maxDuration = 60 // 60 seconds

export async function GET(request: Request) {
    const overallTimer = logger.timing(COMPONENT, "complete-process")
    logger.info(COMPONENT, "PDF processing queue API called")

    try {
        // Properly await cookies()
        logger.debug(COMPONENT, "Getting cookies")
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
        logger.debug(COMPONENT, "Supabase client created")

        // Get the session for audit logging
        const {
            data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user

        // Get the next pending item from the queue
        logger.info(COMPONENT, "Fetching next pending item from queue")
        const { data: queueItem, error: queueError } = await supabase
            .from("pdf_processing_queue")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(1)
            .single()

        if (queueError || !queueItem) {
            logger.info(COMPONENT, "No pending items in queue", { error: queueError?.message })

            // Log the no items event if we have a user
            if (user) {
                await logServerAuditEvent(supabase, {
                    userId: user.id,
                    userEmail: user.email || "",
                    actionType: "process",
                    entityType: "pdf_queue",
                    details: { status: "no_items" },
                })
            }

            return NextResponse.json(
                {
                    message: "No pending items in queue",
                    error: queueError?.message,
                },
                { status: 404 },
            )
        }

        logger.info(COMPONENT, "Found pending item in queue", {
            queueItemId: queueItem.id,
            fileId: queueItem.file_id,
            filePath: queueItem.file_path,
        })

        // Update the queue item status to processing
        logger.debug(COMPONENT, "Updating queue item status to processing", { queueItemId: queueItem.id })
        await supabase.from("pdf_processing_queue").update({ status: "processing" }).eq("id", queueItem.id)

        // Log the processing started event if we have a user
        if (user) {
            await logServerAuditEvent(supabase, {
                userId: user.id,
                userEmail: user.email || "",
                actionType: "process",
                entityType: "pdf_queue",
                entityId: queueItem.id,
                details: {
                    status: "processing_started",
                    file_id: queueItem.file_id,
                    file_path: queueItem.file_path,
                },
            })
        }

        try {
            // Download the PDF file
            logger.info(COMPONENT, "Downloading PDF file from storage", { filePath: queueItem.file_path })
            const downloadTimer = logger.timing(COMPONENT, "download-pdf")
            const { data: fileData, error: downloadError } = await supabase.storage
                .from("nursing-home-files")
                .download(queueItem.file_path)
            downloadTimer.end()

            if (downloadError) {
                logger.error(COMPONENT, "Error downloading PDF file", downloadError)
                throw downloadError
            }

            logger.info(COMPONENT, "PDF file downloaded successfully", {
                fileSize: fileData.size,
                fileType: fileData.type,
            })

            // Convert the Blob to ArrayBuffer for processing
            logger.debug(COMPONENT, "Converting Blob to ArrayBuffer")
            const arrayBufferTimer = logger.timing(COMPONENT, "blob-to-arraybuffer")
            const arrayBuffer = await fileData.arrayBuffer()
            arrayBufferTimer.end()
            logger.debug(COMPONENT, "Blob converted to ArrayBuffer", { bufferSize: arrayBuffer.byteLength })

            // Extract metadata and text
            let extractedText = ""
            let metadata = { numPages: 0, info: {} }
            const fileName = queueItem.file_path.split('/').pop() || "";

            try {
                // Try to get PDF metadata
                logger.info(COMPONENT, "Getting PDF metadata")
                const metadataTimer = logger.timing(COMPONENT, "get-metadata")
                metadata = await getPDFMetadata(arrayBuffer)
                metadataTimer.end()
                logger.info(COMPONENT, "PDF metadata retrieved", {
                    pages: metadata.numPages,
                    title: fileName || "Untitled",
                })

                // Try to extract text
                logger.info(COMPONENT, "Extracting text from PDF")
                const extractionTimer = logger.timing(COMPONENT, "extract-text")
                extractedText = await extractTextFromPDF(arrayBuffer)
                extractionTimer.end()

                const textLength = extractedText.length
                logger.info(COMPONENT, "Text extracted successfully", {
                    textLength,
                    pages: metadata.numPages,
                })
            } catch (pdfError) {
                logger.error(COMPONENT, "Text extraction failed", pdfError)

                // Fallback: Generate basic information about the PDF
                extractedText = `PDF Text Extraction (Fallback Method)\n\n`
                extractedText += `The system was unable to extract text from this PDF.\n`
                extractedText += `This could be due to the PDF being scanned, encrypted, or in an unsupported format.\n\n`
                extractedText += `File Information:\n`
                extractedText += `- File Path: ${queueItem.file_path}\n`
                extractedText += `- File Size: ${fileData.size} bytes\n`
                extractedText += `- MIME Type: ${fileData.type}\n\n`
                extractedText += `For scanned documents, consider using an OCR service to extract text.`

                logger.info(COMPONENT, "Fallback text generated", { textLength: extractedText.length })
            }

            // Format the extracted text with metadata
            logger.debug(COMPONENT, "Formatting extracted text with metadata")
            const formattedText = `
PDF TEXT EXTRACTION RESULTS
--------------------------
File Path: ${queueItem.file_path}
File Size: ${fileData.size} bytes
Pages: ${metadata.numPages || "Unknown"}
Title: ${fileName || "Untitled"}
Extracted: ${new Date().toISOString()}

CONTENT:
--------------------------
${extractedText}
      `.trim()

            // Update the patient_files table with the extracted text
            logger.info(COMPONENT, "Updating patient_files table with extracted text", {
                fileId: queueItem.file_id,
                textLength: formattedText.length,
            })

            const dbUpdateTimer = logger.timing(COMPONENT, "update-database")
            await supabase
                .from("patient_files")
                .update({
                    parsed_text: formattedText,
                    processing_status: "completed",
                })
                .eq("id", queueItem.file_id)

            // Update the queue item status to completed
            logger.debug(COMPONENT, "Updating queue item status to completed", { queueItemId: queueItem.id })
            await supabase
                .from("pdf_processing_queue")
                .update({
                    status: "completed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", queueItem.id)
            dbUpdateTimer.end()

            // Log the processing completed event if we have a user
            if (user) {
                await logServerAuditEvent(supabase, {
                    userId: user.id,
                    userEmail: user.email || "",
                    actionType: "process",
                    entityType: "pdf_queue",
                    entityId: queueItem.id,
                    details: {
                        status: "processing_completed",
                        file_id: queueItem.file_id,
                        text_length: formattedText.length,
                        pages: metadata.numPages || 0,
                    },
                })
            }

            // AUTO-GENERATE CASE STUDY HIGHLIGHT
            try {
                logger.info(COMPONENT, "Auto-generating case study highlight", { fileId: queueItem.file_id })

                // Get patient data for the case study
                const { data: patientData, error: patientError } = await supabase
                    .from("patient_files")
                    .select("patient_id")
                    .eq("id", queueItem.file_id)
                    .single()

                if (patientError || !patientData) {
                    throw new Error(`Failed to get patient data: ${patientError?.message || "Patient not found"}`)
                }

                const { data: patient, error: patientNameError } = await supabase
                    .from("patients")
                    .select("name")
                    .eq("id", patientData.patient_id)
                    .single()

                if (patientNameError || !patient) {
                    throw new Error(`Failed to get patient name: ${patientNameError?.message}`)
                }

                // Check if we already have a case study highlight for this file
                const { data: existingHighlight } = await supabase
                    .from("case_study_highlights")
                    .select("id")
                    .eq("file_id", queueItem.file_id)
                    .single()

                // Log the start of case study generation
                if (user) {
                    await logServerAuditEvent(supabase, {
                        userId: user.id,
                        userEmail: user.email || "",
                        actionType: "process",
                        entityType: "case_study",
                        entityId: queueItem.file_id,
                        details: {
                            status: "generation_started",
                            file_id: queueItem.file_id,
                            patient_id: patientData.patient_id,
                        },
                    })
                }

                const geenratedHighlight = await generateCaseStudyHighlight(queueItem.file_id)

                // Log the successful generation
                if (user) {
                    await logServerAuditEvent(supabase, {
                        userId: user.id,
                        userEmail: user.email || "",
                        actionType: "process",
                        entityType: "case_study",
                        entityId: queueItem.file_id,
                        details: {
                            status: "generation_completed",
                            file_id: queueItem.file_id,
                            patient_id: patientData.patient_id,
                            text_length: geenratedHighlight.highlight?.length,
                        },
                    })
                }

                logger.info(COMPONENT, "Case study highlight saved to database", { fileId: queueItem.file_id })
            } catch (caseStudyError: any) {
                logger.error(COMPONENT, "Error generating case study highlight", caseStudyError)

                // Log the error but don't fail the overall process
                if (user) {
                    await logServerAuditEvent(supabase, {
                        userId: user.id,
                        userEmail: user.email || "",
                        actionType: "process",
                        entityType: "case_study",
                        entityId: queueItem.file_id,
                        details: {
                            status: "generation_failed",
                            file_id: queueItem.file_id,
                            error: caseStudyError.message,
                        },
                    })
                }

                // We don't throw here because we don't want to fail the overall process
                // if case study generation fails
            }

            logger.info(COMPONENT, "PDF processing completed successfully", {
                queueItemId: queueItem.id,
                fileId: queueItem.file_id,
                processingTime: overallTimer.end(),
            })

            return NextResponse.json({
                message: "PDF processed successfully",
                file_id: queueItem.file_id,
                metadata: {
                    pageCount: metadata.numPages,
                    fileSize: fileData.size,
                    title: fileName,
                },
            })
        } catch (error: any) {
            logger.error(COMPONENT, "Error processing PDF", error)

            // Update the queue item status to failed
            logger.debug(COMPONENT, "Updating queue item status to failed", { queueItemId: queueItem.id })
            await supabase
                .from("pdf_processing_queue")
                .update({
                    status: "failed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", queueItem.id)

            // Update the patient_files status
            logger.debug(COMPONENT, "Updating patient_files status to failed", { fileId: queueItem.file_id })
            await supabase.from("patient_files").update({ processing_status: "failed" }).eq("id", queueItem.file_id)

            // Log the processing failed event if we have a user
            if (user) {
                await logServerAuditEvent(supabase, {
                    userId: user.id,
                    userEmail: user.email || "",
                    actionType: "process",
                    entityType: "pdf_queue",
                    entityId: queueItem.id,
                    details: {
                        status: "processing_failed",
                        file_id: queueItem.file_id,
                        error: error.message,
                    },
                })
            }

            return NextResponse.json(
                {
                    message: "Failed to process PDF",
                    error: error.message,
                },
                { status: 500 },
            )
        }
    } catch (error: any) {
        logger.error(COMPONENT, "Route handler error", error)
        overallTimer.end()

        return NextResponse.json(
            {
                message: "Internal server error",
                error: error.message,
            },
            { status: 500 },
        )
    }
}
