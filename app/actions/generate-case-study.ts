"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import OpenAI from "openai";
import { logServerAuditEvent } from "@/lib/audit-logger"
import { revalidatePath } from "next/cache"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to abbreviate names for PII protection
function abbreviateName(fullName: string): string {
    if (!fullName) return "Patient"

    const nameParts = fullName.trim().split(/\s+/)

    if (nameParts.length === 1) {
        // If only one name, use first initial and asterisks
        return `${nameParts[0][0]}${"*".repeat(Math.min(nameParts[0].length - 1, 2))}`
    }

    // For first name, use first initial
    const firstInitial = nameParts[0][0]

    // For last name, use first initial and asterisks
    const lastInitial = nameParts[nameParts.length - 1][0]

    return `${firstInitial}. ${lastInitial}${"*".repeat(Math.min(nameParts[nameParts.length - 1].length - 1, 2))}`
}

// Helper function to scan and remove potential PII from generated text
function sanitizePII(text: string, patientName: string): string {
    console.log("In Sanitizing text is ", text)
    console.log("In Sanitizing patientName is ", patientName)

    if (!text) return text

    const nameParts = patientName.trim().split(/\s+/)
    let sanitized = text

    // Replace full name occurrences
    sanitized = sanitized.replace(new RegExp(patientName, "gi"), "the patient")

    // Replace first name occurrences if it's at least 3 characters
    if (nameParts[0] && nameParts[0].length >= 3) {
        sanitized = sanitized.replace(new RegExp(`\\b${nameParts[0]}\\b`, "gi"), "the patient")
    }

    // Replace last name occurrences if it's at least 3 characters
    if (nameParts.length > 1 && nameParts[nameParts.length - 1].length >= 3) {
        sanitized = sanitized.replace(new RegExp(`\\b${nameParts[nameParts.length - 1]}\\b`, "gi"), "the patient")
    }

    // Replace common PII patterns
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE REDACTED]") // Phone numbers
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, "[SSN REDACTED]") // SSN
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL REDACTED]") // Email

    return sanitized
}

export async function generateCaseStudyHighlightForPatient(patientId: string) {
    try {
        const supabase = createServerActionClient({ cookies })

        // Get the current user for audit logging
        const {
            data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user

        if (!user) {
            throw new Error("You must be logged in to generate case study highlights")
        }
        // Get the file data
        const { data: fileData, error: fileError } = await supabase
            .from("patient_files")
            .select("id, patient_id, parsed_text")
            .eq("patient_id", patientId)

        let allFilesParsedText = ""
        if (fileData && fileData.length > 0) {
            for (const file of fileData) {
                allFilesParsedText += `${file.parsed_text}\n\n`
            }
        } else {
            console.log("No files found for patient")
        }

        if (fileError || !fileData) {
            throw new Error(`Failed to get file data: ${fileError?.message || "File not found"}`)
        }

        // Get patient data
        const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("name")
            .eq("id", patientId)
            .single()

        if (patientError || !patientData) {
            throw new Error(`Failed to get patient data: ${patientError?.message || "Patient not found"}`)
        }

        // Abbreviate the patient name for PII protection
        const abbreviatedName = abbreviateName(patientData.name)

        // Check if we already have a case study highlight for this file
        const { data: existingHighlight } = await supabase
            .from("patient_case_study_highlights")
            .select("id")
            .eq("patient_id", patientId)
            .single()


        // Prepare the prompt for OpenAI with PII protection instructions
        const prompt = `
        You are a medical case study writer for Puzzle Healthcare. Your task is to create a concise, professional case study highlight based on the following patient discharge document.

        Patient Identifier: ${abbreviatedName}

        IMPORTANT PRIVACY INSTRUCTIONS:
        1. DO NOT include names of family members or other individuals
        2. Focus only on medical information and Puzzle Healthcare's intervention

        Focus on:
        1. The primary medical issues the patient had upon discharge
        2. How Puzzle Healthcare intervened
        3. The specific ways Puzzle Healthcare helped the patient
        4. Any notable outcomes or improvements

        Format your response as a single paragraph (150-200 words) that highlights the medical issues, Puzzle Healthcare's intervention, and the positive impact on the patient. Use professional medical terminology where appropriate.

        Here is the discharge document text:
        ${allFilesParsedText} // Limit to 4000 chars to avoid token limits
        `

        // Generate the case study highlight using OpenAI

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a medical case study writer for Puzzle Healthcare." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 300,
        })
        const rawHighlightText = completion.choices[0].message.content || ""

        // Apply additional PII sanitization to the generated text
        const sanitizedHighlightText = sanitizePII(rawHighlightText, patientData.name)

        // Store the generated highlight in the database
        if (existingHighlight) {
            // Update existing highlight
            await supabase
                .from("patient_case_study_highlights")
                .update({
                    highlight_text: sanitizedHighlightText,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingHighlight.id)
        } else {
            // Create new highlight
            await supabase.from("patient_case_study_highlights").insert({
                patient_id: patientId,
                highlight_text: sanitizedHighlightText,
            })
        }

        return { success: true, highlight: sanitizedHighlightText }
    } catch (error: any) {


        return {
            success: false,
            error: error.message || "Failed to generate case study highlight",
        }
    }
}

export async function generateCaseStudyHighlight(fileId: string) {
    const supabase = createServerActionClient({ cookies })

    // Get the current user for audit logging
    const {
        data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
        throw new Error("You must be logged in to generate case study highlights")
    }

    try {
        // Log the start of the generation process
        await logServerAuditEvent(supabase, {
            userId: user.id,
            userEmail: user.email || "",
            actionType: "process",
            entityType: "patient_file",
            entityId: fileId,
            details: {
                action: "generate_case_study_highlight",
                status: "started",
            },
        })

        // Get the file data
        const { data: fileData, error: fileError } = await supabase
            .from("patient_files")
            .select("id, patient_id, parsed_text")
            .eq("id", fileId)
            .single()

        if (fileError || !fileData) {
            throw new Error(`Failed to get file data: ${fileError?.message || "File not found"}`)
        }

        // Get patient data
        const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("name")
            .eq("id", fileData.patient_id)
            .single()

        if (patientError || !patientData) {
            throw new Error(`Failed to get patient data: ${patientError?.message || "Patient not found"}`)
        }

        // Abbreviate the patient name for PII protection
        const abbreviatedName = abbreviateName(patientData.name)

        // Check if we already have a case study highlight for this file
        const { data: existingHighlight } = await supabase
            .from("case_study_highlights")
            .select("id")
            .eq("file_id", fileId)
            .single()

        // If there's no parsed text, we can't generate a highlight
        if (!fileData.parsed_text) {
            throw new Error("No parsed text available for this file. Please process the PDF first.")
        }

        // Prepare the prompt for OpenAI with PII protection instructions
        const prompt = `
You are a medical case study writer for Puzzle Healthcare. Your task is to create a concise, professional case study highlight based on the following patient discharge document.

Patient Identifier: ${abbreviatedName}

IMPORTANT PRIVACY INSTRUCTIONS:
1. DO NOT include names of family members or other individuals
2. Focus only on medical information and Puzzle Healthcare's intervention

Focus on:
1. The primary medical issues the patient had upon discharge
2. How Puzzle Healthcare intervened
3. The specific ways Puzzle Healthcare helped the patient
4. Any notable outcomes or improvements

Format your response as a single paragraph (150-200 words) that highlights the medical issues, Puzzle Healthcare's intervention, and the positive impact on the patient. Use professional medical terminology where appropriate.

Here is the discharge document text:
${fileData.parsed_text.substring(0, 4000)} // Limit to 4000 chars to avoid token limits
`

        // Generate the case study highlight using OpenAI

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a medical case study writer for Puzzle Healthcare." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 300,
        })
        const rawHighlightText = completion.choices[0].message.content || ""

        // Apply additional PII sanitization to the generated text
        const sanitizedHighlightText = sanitizePII(rawHighlightText, patientData.name)

        // Store the generated highlight in the database
        if (existingHighlight) {
            // Update existing highlight
            await supabase
                .from("case_study_highlights")
                .update({
                    highlight_text: sanitizedHighlightText,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingHighlight.id)
        } else {
            // Create new highlight
            await supabase.from("case_study_highlights").insert({
                patient_id: fileData.patient_id,
                file_id: fileId,
                highlight_text: sanitizedHighlightText,
            })
        }

        // Log the successful generation
        await logServerAuditEvent(supabase, {
            userId: user.id,
            userEmail: user.email || "",
            actionType: "process",
            entityType: "patient_file",
            entityId: fileId,
            details: {
                action: "generate_case_study_highlight",
                status: "completed",
                patient_id: fileData.patient_id,
            },
        })

        // Revalidate the page to show the new highlight
        revalidatePath(`/patients/${fileData.patient_id}/files/${fileId}/view`)

        return { success: true, highlight: sanitizedHighlightText }
    } catch (error: any) {
        // Log the error
        if (user) {
            await logServerAuditEvent(supabase, {
                userId: user.id,
                userEmail: user.email || "",
                actionType: "process",
                entityType: "patient_file",
                entityId: fileId,
                details: {
                    action: "generate_case_study_highlight",
                    status: "failed",
                    error: error.message,
                },
            })
        }

        return {
            success: false,
            error: error.message || "Failed to generate case study highlight",
        }
    }
}
