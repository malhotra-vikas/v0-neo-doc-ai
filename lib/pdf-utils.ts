import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.js'
import { logger } from './logger'
const pdfParse = require("pdf-parse")

const COMPONENT = "PDFUtils"

// Configure PDF.js for Node.js (disable worker usage)
PDFJS.GlobalWorkerOptions.workerSrc = ''

// @ts-ignore
global.pdfjsWorker = null



export async function extractTextWithPDFjs(arrayBuffer: ArrayBuffer): Promise<string> {
    logger.info(COMPONENT, `Starting on EXTRACTION `)

    PDFJS.GlobalWorkerOptions.workerSrc = ''


    const doc = await PDFJS.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    let fullText = ''
    logger.info(COMPONENT, `EXTRACTION Started. Page count: ${doc.numPages}`)

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n\n'
    }

    return fullText.trim()
}

/**
 * Extract text from a PDF file using a Node.js compatible approach
 * @param pdfData The PDF file data as ArrayBuffer
 * @returns A promise that resolves to the extracted text
 */
export async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string> {
    const timer = logger.timing(COMPONENT, "extractTextFromPDF")
    logger.info(COMPONENT, `Starting PDF text extraction, size: ${pdfData.byteLength} bytes`)

    try {
        const buffer = Buffer.from(new Uint8Array(pdfData))
        //const pdfParse = (await import("pdf-parse")).default

        const data = await pdfParse(buffer)
        logger.info(COMPONENT, `Extracted text length: ${data.text.length}`)

        return data.text || "No text content found in this PDF."
    } catch (pdfParseError) {
        logger.error(COMPONENT, "pdf-parse failed. Falling back to PDF.js:", pdfParseError)
        return extractWithPDFjsFallback(pdfData)
    } finally {
        timer.end()
    }
}

/**
 * Fallback: Use PDF.js for basic extraction (first few pages only).
 */
async function extractWithPDFjsFallback(pdfData: ArrayBuffer): Promise<string> {
    try {
        const doc = await PDFJS.getDocument({
            data: pdfData,
            disableWorker: true,
            isEvalSupported: false,
            useSystemFonts: true,
        }).promise

        let text = ""

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items.map((item: any) => item.str).join(" ")
            text += `--- Page ${i} ---\n${pageText}\n\n`
        }


        return text || "No text extracted with fallback."
    } catch (err) {
        logger.error(COMPONENT, "PDF.js fallback failed:", err)
        return "PDF text extraction failed (pdf-parse + fallback)."
    }
}

/**
 * Extract metadata from a PDF using pdf-parse.
 */
export async function getPDFMetadata(pdfData: ArrayBuffer): Promise<any> {
    const timer = logger.timing(COMPONENT, "getPDFMetadata")

    try {
        const buffer = Buffer.from(pdfData)
        const pdfParse = (await import("pdf-parse")).default

        const data = await pdfParse(buffer, { max: 1 }) // Only need the first page
        return {
            info: {
                Title: data.info?.Title || "Untitled",
                Author: data.info?.Author || "Unknown",
                CreationDate: data.info?.CreationDate || "Unknown",
            },
            metadata: data.metadata,
            numPages: data.numpages,
        }
    } catch (error) {
        logger.error(COMPONENT, "Error extracting metadata:", error)
        return {
            info: {
                Title: "Untitled",
                Author: "Unknown",
                CreationDate: "Unknown",
            },
            numPages: 0,
            error: `Failed to get metadata: ${error instanceof Error ? error.message : String(error)}`,
        }
    } finally {
        timer.end()
    }
}
