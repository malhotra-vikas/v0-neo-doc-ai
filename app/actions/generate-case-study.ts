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
            .select("id, file_type, patient_id, parsed_text")
            .eq("patient_id", patientId)

        let allFilesParsedText = ""
        if (fileData && fileData.length > 0) {
            for (const file of fileData) {
                allFilesParsedText += `---\nFile ID: ${file.id}\nFile Type: ${file.file_type}\n\n${file.parsed_text}\n\n`;
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
You are a medical case study generator for Puzzle Healthcare.

Given a patient discharge document, extract:
1. A concise professional case study highlight
2. Interventions provided by Puzzle Health Care
3. Key interventions and outcomes
4. Top clinical risks

For each section, also include 1-2 source quotes from the discharge text that support the content. Do not fabricate — only use actual phrases or sentences from the text.
For each quote, include the associated File ID from the document chunks. You will find these clearly marked like:
---
File ID: 123
File Type: Discharge Summary

<parsed text>

Patient Identifier: ${abbreviatedName}

PRIVACY INSTRUCTIONS:
- Do NOT include names of family or individuals
- Do NOT include any PII
- Focus only on medical and clinical information relevant to Puzzle Healthcare's role
- Highlight and Focus on how Puzzle Healthcare intervened and the specific ways Puzzle Healthcare helped the patient
- Use professional tone, no superlatives

Return valid JSON in this format:

{
  "hospital_discharge_summary": {
    "summary": "200 word paragraph that summarizes the patient's hospital discharge. Use professional medical terminology. No superlatives.",
    "source_quotes": [
         { "quote": "quote 1", "source_file_id": "123" },
         { "quote": "quote 2", "source_file_id": "456" }
    ] 
  },
  "highlight": {
    "summary": "150-200 word paragraph that highlights Puzzle Healthcare's intervention during SNF and during the Patient Engagements, and the positive impact on the patient. Use professional medical terminology.  No superlatives.",
    "source_quotes": [
         { "quote": "quote 1", "source_file_id": "123" },
         { "quote": "quote 2", "source_file_id": "456" }
    ] 
  },
  "interventions": [
    { "intervention": "Intervention A", "source_quote": "quote A", "source_file_id": "789"  },
    { "intervention": "Intervention B", "source_quote": "quote A", "source_file_id": "789"  }
  ],
  "outcomes": [
    { "outcome": "Outcome A", "source_quote": "quote A", "source_file_id": "789"  }
  ],
  "clinical_risks": [
    { "risk": "Risk A", "source_quote": "quote A", "source_file_id": "789"  }
  ]
}

Only return valid JSON — no commentary or explanation. Here is the discharge document text:

Discharge text:
${allFilesParsedText}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a medical case study writer for Puzzle Healthcare." },
                { role: "user", content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 1500,
        });

        let outputJson, hospital_discharge_summary, highlight, interventions, outcomes, clinical_risks;
        try {
            let cleanedJson = completion.choices[0].message.content.trim();
            if (cleanedJson.startsWith("```json")) {
                cleanedJson = cleanedJson.replace(/```json|```/g, "").trim();
            }

            outputJson = JSON.parse(cleanedJson);

            ({ hospital_discharge_summary, highlight, interventions, outcomes, clinical_risks } = outputJson);

            console.log("📝 Summary:", hospital_discharge_summary?.summary);
            console.log("📌 Highlight:", highlight?.summary);

        } catch (err) {
            console.error("Failed to parse OpenAI response:", err);
            outputJson = { error: "Invalid JSON", raw: completion.choices[0].message.content };
        }

        const sanitizedSummary = sanitizePII(hospital_discharge_summary?.summary || "", patientData.name);
        const sanitizedHighlight = sanitizePII(highlight?.summary || "", patientData.name);

        const highlightPayload = {
            hospital_discharge_summary_text: sanitizedSummary,
            hospital_discharge_summary_quotes: hospital_discharge_summary?.source_quotes || [],
            highlight_text: sanitizedHighlight,
            highlight_quotes: highlight?.source_quotes || [],
            interventions,
            outcomes,
            clinical_risks,
            updated_at: new Date().toISOString()
        };

        console.log("✅ Payload to save:", highlightPayload);

        if (existingHighlight) {
            await supabase
                .from("patient_case_study_highlights")
                .update(highlightPayload)
                .eq("id", existingHighlight.id);
        } else {
            await supabase
                .from("patient_case_study_highlights")
                .insert({ patient_id: patientId, ...highlightPayload });
        }

        return { success: true, highlight: highlightPayload };

    } catch (error: any) {
        return {
            success: false,
            error: error.message || "Failed to generate case study highlight"
        };
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
            .select("id, patient_id, parsed_text, file_type")
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

        const promptPatientEngagement = `
You are a medical case study writer for Puzzle Healthcare. Your task is to create a concise, professional case study highlight based on the following patient discharge document.

Patient Identifier: ${abbreviatedName}

IMPORTANT PRIVACY INSTRUCTIONS:
1. DO NOT include names of family members or other individuals
2. Focus only on medical information and Puzzle Healthcare's intervention

Focus on:
1. How Puzzle Healthcare intervened
2. The specific ways Puzzle Healthcare helped the patient
3. Any notable outcomes or improvements
4. Do Not add any superlatives 

Format your response as a single paragraph (150-200 words) that highlights the Puzzle Healthcare's intervention, and the positive impact on the patient. Use professional medical terminology where appropriate.

Here is the discharge document text:
${fileData.parsed_text} // Limit to 4000 chars to avoid token limits
`
        // Prepare the prompt for OpenAI with PII protection instructions
        const promptGeneral = `
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
5. Do Not add any superlatives 

Format your response as a single paragraph (150-200 words) that highlights the medical issues, Puzzle Healthcare's intervention, and the positive impact on the patient. Use professional medical terminology where appropriate.

Here is the discharge document text:
${fileData.parsed_text} // Limit to 4000 chars to avoid token limits
`

        let prompt = promptGeneral
        let fileType = fileData.file_type

        if (fileType === 'Patient Engagement') {
            prompt = promptPatientEngagement
        }


        // Generate the case study highlight using OpenAI

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
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
