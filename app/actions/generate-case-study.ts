"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import OpenAI from "openai";
import { logServerAuditEvent } from "@/lib/audit-logger"
import { revalidatePath } from "next/cache"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

        // Prepare the prompt for OpenAI
        const prompt = `
You are a medical case study writer for Puzzle Healthcare. Your task is to create a concise, professional case study highlight based on the following patient discharge document.

Patient Name: ${patientData.name}

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

        const highlightText = completion.choices[0].message.content || ""


        // Store the generated highlight in the database
        if (existingHighlight) {
            // Update existing highlight
            await supabase
                .from("case_study_highlights")
                .update({
                    highlight_text: highlightText,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingHighlight.id)
        } else {
            // Create new highlight
            await supabase.from("case_study_highlights").insert({
                patient_id: fileData.patient_id,
                file_id: fileId,
                highlight_text: highlightText,
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

        return { success: true, highlight: highlightText }
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
