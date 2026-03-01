import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"
import { logger } from "./logger"

const COMPONENT = "PDFUtils"

/**
 * Run the Python parser (scripts/parse_pdf.py) on a PDF buffer
 */
async function extractWithPython(pdfData: ArrayBuffer): Promise<string> {
    // Write PDF to a temporary file
    const tmpPath = path.join(os.tmpdir(), `pdf-${Date.now()}.pdf`)
    await fs.promises.writeFile(tmpPath, Buffer.from(pdfData))

    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(process.cwd(), "scripts/parse_pdf.py")
        const pythonPath = path.resolve(process.cwd(), "venv/bin/python")

        const py = spawn(pythonPath, [scriptPath, tmpPath])
        let output = ""
        let error = ""

        py.stdout.on("data", (data) => (output += data.toString()))
        py.stderr.on("data", (data) => (error += data.toString()))

        py.on("close", async (code) => {
            await fs.promises.unlink(tmpPath).catch(() => { })

            if (code === 0) {
                try {
                    const result = JSON.parse(output)
                    resolve(result.text || "")
                } catch (parseErr: any) {
                    reject(new Error("Failed to parse Python output: " + parseErr.message))
                }
            } else {
                reject(new Error("Python process failed: " + error))
            }
        })
    })
}

/**
 * Extract text from a PDF file (always via Python)
 */
export async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string> {
    const timer = logger.timing(COMPONENT, "extractTextFromPDF")
    logger.info(COMPONENT, `Starting Python-based PDF text extraction, size: ${pdfData.byteLength} bytes`)

    try {
        const text = await extractWithPython(pdfData)
        logger.info(COMPONENT, `Extracted text length: ${text.length}`)
        return text || "No text content found in this PDF."
    } catch (err) {
        logger.error(COMPONENT, "Python extraction failed:", err)
        return "Python extraction failed."
    } finally {
        timer.end()
    }
}

/**
 * Metadata extraction can still use pdf-parse if you want lightweight info,
 * but if you want consistency, you can also build a Python endpoint for metadata.
 */
export async function getPDFMetadata(pdfData: ArrayBuffer): Promise<any> {
    const timer = logger.timing(COMPONENT, "getPDFMetadata")
    try {
        // Simple metadata stub — expand via Python if needed
        return {
            info: {
                Title: "Untitled",
                Author: "Unknown",
                CreationDate: "Unknown",
            },
            numPages: 0,
            note: "Metadata extraction is not implemented in Python pipeline",
        }
    } finally {
        timer.end()
    }
}
