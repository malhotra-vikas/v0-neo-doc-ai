// lib/pdf-utils.server.ts
"use server";

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./logger";

const COMPONENT = "PDFUtils";

function pythonBin() {
    // Prefer project venv if present
    const venv = path.join(process.cwd(), ".venv", "bin", "python3");
    if (fs.existsSync(venv)) return venv;
    // Fallback to system python3
    return "python3";
}

function toBuffer(data: ArrayBuffer | Uint8Array | Buffer): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof Uint8Array) return Buffer.from(data);
    return Buffer.from(new Uint8Array(data));
}

async function extractWithPython(pdfData: ArrayBuffer | Uint8Array | Buffer): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    await fs.promises.writeFile(tmpPath, Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(new Uint8Array(pdfData as ArrayBuffer)));

    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(process.cwd(), "scripts/parse_pdf.py");
        const py = spawn(pythonBin(), [scriptPath, tmpPath]);  // <-- use venv python

        let output = "", error = "";
        py.stdout.on("data", d => (output += d.toString()));
        py.stderr.on("data", d => (error += d.toString()));
        py.on("close", async code => {
            await fs.promises.unlink(tmpPath).catch(() => { });
            if (code === 0) {
                try {
                    const { text } = JSON.parse(output);
                    resolve(text || "");
                } catch (e: any) {
                    reject(new Error("Failed to parse Python output: " + e.message));
                }
            } else {
                reject(new Error("Python process failed: " + error));
            }
        });
    });
}

export async function extractTextFromPDF(pdfData: ArrayBuffer | Uint8Array | Buffer): Promise<string> {
    const t = logger.timing(COMPONENT, "extractTextFromPDF");
    logger.info(COMPONENT, `Starting Python-based PDF text extraction, size: ${(pdfData as any).byteLength ?? "unknown"
        } bytes`);
    try {
        const text = await extractWithPython(pdfData);
        logger.info(COMPONENT, `Extracted text length: ${text.length}`);
        return text || "No text content found in this PDF.";
    } catch (err) {
        logger.error(COMPONENT, "Python extraction failed:", err);
        return "Python extraction failed.";
    } finally {
        t.end();
    }
}

export async function getPDFMetadata(_pdfData: ArrayBuffer | Uint8Array | Buffer): Promise<any> {
    const t = logger.timing(COMPONENT, "getPDFMetadata");
    try {
        return {
            info: { Title: "Untitled", Author: "Unknown", CreationDate: "Unknown" },
            numPages: 0,
            note: "Metadata extraction is not implemented in Python pipeline",
        };
    } finally {
        t.end();
    }
}
