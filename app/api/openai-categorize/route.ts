import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function tryFixTruncatedJson(raw: string): string {
    try {
        // Remove common markdown wrappers
        if (raw.startsWith("```json")) {
            raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
        }

        // Attempt to slice to last complete bracket
        const lastBrace = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
        if (lastBrace !== -1) {
            raw = raw.slice(0, lastBrace + 1);
        }

        return raw;
    } catch (err) {
        console.warn("⚠️ JSON cleanup failed:", err);
        return raw;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that classifies healthcare interventions into clear subcategories like 'Transitional Support', 'Clinical Risk Management', 'Care Navigation', and 'Engagement & Education'. Respond with ONLY valid JSON. No explanation. No markdown.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
        });

        let raw = completion.choices[0].message.content?.trim();
        if (!raw) throw new Error("OpenAI returned empty content");

        const cleaned = tryFixTruncatedJson(raw);

        let categories;
        try {
            categories = JSON.parse(cleaned);
        } catch (err) {
            console.error("🛑 Failed to parse OpenAI JSON response:");
            console.log("------ RAW START ------");
            console.log(raw?.slice(0, 1000)); // Log only 1k chars for safety
            console.log("------ RAW END --------");

            return new Response(
                JSON.stringify({
                    error: "Failed to parse OpenAI response",
                    raw: raw?.slice(0, 1000),
                }),
                { status: 500 }
            );
        }

        return Response.json({ categories });
    } catch (err: any) {
        console.error("❌ Categorization API error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Failed to categorize interventions" }),
            { status: 500 }
        );
    }
}
