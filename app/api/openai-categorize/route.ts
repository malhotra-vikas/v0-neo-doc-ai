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
        console.log("in API Call,. POST Prompt is ", prompt)

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that classifies healthcare interventions into clear subcategories.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
        });

        let raw = completion.choices[0].message.content?.trim();
        console.log("in API Call,. POST REsponse is ", raw)

        if (!raw) throw new Error("OpenAI returned empty content");

        const cleaned = tryFixTruncatedJson(raw);
        console.log("in API Call,. POST Cleaned REsponse is ", cleaned)

        return new Response(cleaned, {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("❌ Categorization API error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Failed to categorize interventions" }),
            { status: 500 }
        );
    }
}
