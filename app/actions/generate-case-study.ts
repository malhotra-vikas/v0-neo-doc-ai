"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import OpenAI from "openai";
import { logServerAuditEvent } from "@/lib/audit-logger"
import { revalidatePath } from "next/cache"
import pLimit from "p-limit"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOKEN_LIMIT_PER_MINUTE = Number(process.env.TOKEN_LIMIT_PER_MINUTE) || 30000
const TOKEN_BUFFER = Number(process.env.TOKEN_BUFFER) || 10000

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

    if (typeof text !== "string") {
        console.warn("⚠ sanitizePII received non-string input:", text);
        return "";
    }

    // ⛑ Force text to be a string (in case it’s a number, object, etc.)
    let sanitized = String(text);

    const nameParts = patientName.trim().split(/\s+/)

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

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// p-limit parallel handler
export const processPatientsWithLimit = async (patientIds: string[], concurrency: number = 25) => {
    const limit = pLimit(concurrency)
    const results: any[] = []

    const WINDOW_MS = 60 * 1000

    const usageHistory: { timestamp: number; tokens: number }[] = []

    const getTokensUsedInLastMinute = () => {
        const now = Date.now()
        // Remove old entries beyond 60s window
        while (usageHistory.length > 0 && usageHistory[0].timestamp < now - WINDOW_MS) {
            usageHistory.shift()
        }
        return usageHistory.reduce((sum, record) => sum + record.tokens, 0)
    }

    for (let i = 0; i < patientIds.length; i++) {
        const id = patientIds[i]

        const task = limit(async () => {
            // Check and wait if we're over the threshold
            while (getTokensUsedInLastMinute() >= TOKEN_LIMIT_PER_MINUTE - TOKEN_BUFFER) {
                console.log("⏱ Throttling to respect TPM... waiting 30s")
                await sleep(30000)
            }

            console.log("🚀 Processing patient:", id)

            const result = await generateCaseStudyHighlightForPatient(id)
            const tokensUsed = result?.tokensUsed ?? 0

            usageHistory.push({ timestamp: Date.now(), tokens: tokensUsed })
            console.log(`🔢 Just used ${tokensUsed} tokens. Total in last 60s: ${getTokensUsedInLastMinute()}`)

            return result
        })

        results.push(task)
    }

    return Promise.all(results)
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

        let hospitalText = "", facilityText = "", engagementText = "";

        if (fileData && fileData.length > 0) {
            fileData.forEach(file => {
                const textBlock = `---\nFile ID: ${file.id}\nFile Type: ${file.file_type}\n\n${file.parsed_text}\n\n`;
                if (file.file_type === 'Patient Hospital Stay Notes') hospitalText += textBlock;
                if (file.file_type === 'Patient In Facility') facilityText += textBlock;
                if (file.file_type === 'Patient Engagement') engagementText += textBlock;
            });
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

        console.log("existingHighlight for patient - ", existingHighlight)

        // Prepare the prompt for OpenAI with PII protection instructions
        // Hospital Stay Notes
        const patientHospitalStayPrompt = `
You are a clinical summarization assistant for Puzzle Healthcare.

Your task is to read the extracted text from the patient’s **Hospital Stay** document and generate a concise **Medical Summary** that answers the following:

1. Why was the patient admitted to the hospital? Include the presenting complaint, primary diagnoses, and any major comorbidities.
2. What procedures, treatments, or clinical evaluations were performed?
3. What were the key clinical observations or concerns during the stay?
4. What medications or therapies were initiated or adjusted?
5. What was the discharge status and any follow-up instructions or care coordination?
6. What are the key Clinical Risks upon Discharge that needs to be managed post discharge?

Write in clear, medically accurate language using short paragraphs or bullet points. Focus on clinical clarity, avoid speculation, and do not include irrelevant administrative details.
No not add any hyperbole like "significantly", "immensely", etc. Only report facts.

For each section, also include 1-2 source quotes from the source text that support the content. Do not fabricate — only use actual phrases or sentences from the text.
For each quote, include the associated File ID from the document chunks. You will find these clearly marked like:
---
File ID: 123
File Type: Discharge Summary

<parsed text>

Patient Identifier: ${abbreviatedName}

PRIVACY INSTRUCTIONS:
- Do not include patient name. Instead refer to him/ her as "The Patient"
- Do NOT include names of family or individuals
- Do NOT include any PII
- Focus only on medical and clinical information relevant to Puzzle Healthcare's role
- Highlight and Focus on how Puzzle Healthcare intervened and the specific ways Puzzle Healthcare helped the patient
- Use professional tone, no superlatives

Return valid JSON in this format:

{
  "hospital_discharge_summary": {
    "summary": "150-200 word paragraph that summarizes the patient's hospital discharge. Use professional medical terminology. No superlatives.",
    "source_quotes": [
         { "quote": "quote 1", "source_file_id": "123" },
         { "quote": "quote 2", "source_file_id": "456" }
    ],
    "clinical_risks": [
        { "risk": "Risk A", "source_quote": "quote A", "source_file_id": "789"  }
    ]
  }
}

Only return valid JSON — no commentary or explanation. Here is the hospital discharge document text:

Discharge text:
${hospitalText}
        `;
        // Patient in Facility Notes

        const patientInFacilityPrompt = `
You are a medical summarization assistant for Puzzle Healthcare.

Your task is to review the extracted text from the patient’s In-Facility document and generate a concise, medically accurate Medical Summary strictly focused on Puzzle Healthcare’s involvement within the scope of physiatry.

⚠️ Important constraints – DO NOT VIOLATE:
Puzzle NEVER prescribes or manages medications.
Puzzle NEVER recomends or initiates any therapy.
Do NOT add any dates to the summary.
Exclude all care managed by the facility’s primary care or nursing teams.
Include ONLY actions, findings, or assessments that fall within the scope of physiatry.
No not add any hyperbole like "significantly", "immensely", etc. Only report facts.
Do not use words like "initiate", "recommeded".
Your summary must address the following, clearly emphasizing Puzzle’s physiatry-specific role:

1. Visit Frequency & Encounter Timing
When Puzzle providers saw or rounded on the patient, and how often.
Clinical Assessments by Puzzle
Relevant physiatry assessments performed (e.g., functional mobility, musculoskeletal, neurocognitive, pain, rehab needs).
Objective findings tied to functional or rehabilitative domains.

2. Physiatry-Specific Interventions
Only include interventions initiated, managed, or recommended by Puzzle providers within the physiatry scope, such as:
Therapy orders or adjustments (PT/OT/ST)
DME evaluation or recommendations
Wound care planning (when related to mobility/rehab context)
Imaging or labs ordered or coordinated by Puzzle
Specialist referrals or follow-ups initiated by Puzzle

3. Escalation & Coordination
Any escalation of care or coordination with external providers or hospitals directly led by Puzzle, within physiatry domain.

4. Continuity of Care & Impact
How Puzzle contributed to recovery, functional improvement, rehab progression, or discharge planning — again, within physiatry scope only.

For each section, also include 1-2 source quotes from the source text that support the content. Do not fabricate — only use actual phrases or sentences from the text.
For each quote, include the associated File ID from the document chunks. You will find these clearly marked like:
---
File ID: 123
File Type: Discharge Summary

<parsed text>

Patient Identifier: ${abbreviatedName}

PRIVACY INSTRUCTIONS:
- Do not include patient name. Instead refer to him/ her as "The Patient"
- Do NOT include names of family or individuals
- Do NOT include any PII
- Focus only on medical and clinical information relevant to Puzzle Healthcare's role
- Highlight and Focus on how Puzzle Healthcare intervened and the specific ways Puzzle Healthcare helped the patient
- Use professional tone, no superlatives

Return valid JSON in this format:

{
  "in_facility_summary": {
    "summary": "200-250 word paragraph that summarizes the patient's in facility interventions. Use professional medical terminology. No superlatives.",
    "source_quotes": [
         { "quote": "quote 1", "source_file_id": "123" },
         { "quote": "quote 2", "source_file_id": "456" }
    ] 
  }
}

Only return valid JSON — no commentary or explanation. Here is the in facility document text:

Discharge text:
${facilityText}
        `;

        // Engagement notes
        const patientEngagementPrompt = `
You are a clinical AI assistant focused on medical engagement summaries.

Read the extracted text from the **Patient Engagement** document and produce a medically accurate **summary of patient engagement activities**. 
Puzzle NEVER prescribes medication, keep that in mind while building the summary.

⚠️ Important constraints – DO NOT VIOLATE:
Puzzle NEVER prescribes or manages medications.
Puzzle NEVER recomends or initiates any therapy.
Do NOT add any dates to the summary.
No not add any hyperbole like "significantly", "immensely", etc. Only report facts.
Exclude all care managed by the facility’s primary care or nursing teams.
Include ONLY actions, findings, or assessments that fall within the scope of physiatry.

Focus on the following structure:

1. **Assessment** – 200-250 word summary on what was observed or assessed about the patient (e.g., behavior, mood, understanding, adherence)?
2. **Intervention** – What was done during engagement? Include education, motivation, care coordination, or behavioral interventions. Puzzle NEVER prescribes medication.
3. **Outcome** – What was the result or follow-up from the engagement? Was there progress, resistance, follow-through, or a need for further support?

Structure the summary clearly under the three sections above. Be specific, clinical, and concise. Avoid generic statements and focus on measurable actions or observations documented in the engagement notes.

For each section, also include 1-2 source quotes from the source text that support the content. Do not fabricate — only use actual phrases or sentences from the text.
For each quote, include the associated File ID from the document chunks. You will find these clearly marked like:
---
File ID: 123
File Type: Discharge Summary

<parsed text>

Patient Identifier: ${abbreviatedName}

PRIVACY INSTRUCTIONS:
- Do not include patient name. Instead refer to him/ her as "The Patient"
- Do NOT include names of family or individuals
- Do NOT include any PII
- Focus only on medical and clinical information relevant to Puzzle Healthcare's role
- Highlight and Focus on how Puzzle Healthcare intervened and the specific ways Puzzle Healthcare helped the patient
- Use professional tone, no superlatives

Return valid JSON in this format:

{
  "assessment": {
    "summary": "200-250 word paragraph that summarizes the patient's interventions. Use professional medical terminology. No superlatives.",
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
  ],}

Only return valid JSON — no commentary or explanation. Here is the patient engagemnt document text:

Discharge text:
${engagementText}
        `;

        // Common function to send a prompt
        const getPromptedJSON = async (prompt: string) => {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a medical case study writer for Puzzle Healthcare." },
                    { role: "user", content: prompt },
                ],
                temperature: 0.5,
                max_tokens: 1300,
            });

            const tokensUsed = completion.usage?.total_tokens ?? 0
            console.log(`🧠 Tokens used in this prompt: ${tokensUsed}`)

            let content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("No response from OpenAI");

            // Strip markdown code block wrapping (e.g., ```json\n...\n```)
            content = content.trim();
            if (content.startsWith("```")) {
                content = content.replace(/^```json\n?/, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(content) // This will throw if invalid JSON

            return { data: parsed, tokensUsed }
        };

        let sanitizedHospitalSummary, sanitizedFacilitySummary, sanitizedEngagementSummary;

        const [hospitalResp, facilityResp, engagementResp] = await Promise.all([
            getPromptedJSON(patientHospitalStayPrompt).catch(e => { console.error("❌ Hospital", e); return null }),
            getPromptedJSON(patientInFacilityPrompt).catch(e => { console.error("❌ Facility", e); return null }),
            getPromptedJSON(patientEngagementPrompt).catch(e => { console.error("❌ Engagement", e); return null }),
        ])

        const hospitalData = hospitalResp?.data ?? {}
        const facilityData = facilityResp?.data ?? {}
        const engagementData = engagementResp?.data ?? {}

        const totalTokensUsed = (hospitalResp?.tokensUsed ?? 0) + (facilityResp?.tokensUsed ?? 0) + (engagementResp?.tokensUsed ?? 0)
        console.log(`📊 Total tokens used for this patient: ${totalTokensUsed}`)

        try {
            console.log("🏥 Hospital Summary:\n", hospitalData);
            sanitizedHospitalSummary = hospitalData.hospital_discharge_summary?.summary

        } catch (err) {
            console.error("❌ Failed to get hospital summary:", err);
        }

        try {
            console.log("🏨 In-Facility Summary:\n", facilityData);
            sanitizedFacilitySummary = facilityData.in_facility_summary?.summary
        } catch (err) {
            console.error("❌ Failed to get facility summary:", err);
        }

        try {
            console.log("🧑‍⚕️ Engagement Summary:\n", engagementData);
            sanitizedEngagementSummary = engagementData.assessment?.summary
        } catch (err) {
            console.error("❌ Failed to get engagement summary:", err);
        }

        const highlightPayload = {
            hospital_discharge_summary_text: sanitizedHospitalSummary || "",
            hospital_discharge_summary_quotes: hospitalData.hospital_discharge_summary?.source_quotes || [],

            facility_summary_text: sanitizedFacilitySummary || "",
            facility_summary_quotes: facilityData.in_facility_summary?.source_quotes || [],

            engagement_summary_text: sanitizedEngagementSummary || "",
            engagement_summary_quotes: engagementData.assessment?.source_quotes || [],

            interventions: [],
            outcomes: [],
            clinical_risks: hospitalData.hospital_discharge_summary.clinical_risks, // You can extract later if needed
            detailed_interventions: engagementData.interventions || [],
            detailed_outcomes: engagementData.outcomes || [],
            detailed_clinical_risks: hospitalData.hospital_discharge_summary.clinical_risks,
            updated_at: new Date().toISOString()
        };
        console.log("✅ Payload to save:", JSON.stringify(highlightPayload, null, 2));
        console.log("✅ Payload to save for existingHighlight:", existingHighlight?.id);
        console.log("✅ Payload to save for PatientId:", patientId);

        try {
            if (existingHighlight) {
                await supabase
                    .from("patient_case_study_highlights")
                    .update(highlightPayload)
                    .eq("id", existingHighlight.id);
                console.log("✅ Patient Case Study updated");

            } else {
                await supabase
                    .from("patient_case_study_highlights")
                    .insert({ patient_id: patientId, ...highlightPayload });
                console.log("✅ Patient Case Study created");

            }
        } catch (err) {
            console.error("❌ Failed to create/ update the Case Study:", err);

        }


        //return { success: true, highlight: highlightPayload };
        return { success: true, highlight: highlightPayload, tokensUsed: totalTokensUsed };

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
