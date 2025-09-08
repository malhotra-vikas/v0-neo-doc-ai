// app/actions/parse-pdf.ts
"use server";

import { extractTextFromPDF, getPDFMetadata } from "@/lib/pdf-utils-server";


export async function extractPdfTextAction(fileBuffer: ArrayBuffer) {
    const [text, meta] = await Promise.all([
        extractTextFromPDF(fileBuffer),
        getPDFMetadata(fileBuffer),
    ]);
    return { text, meta };
}
