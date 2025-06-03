import { NextRequest } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json()

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that classifies healthcare interventions into subcategories.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 1000,
        })

        let raw = completion.choices[0].message.content?.trim()
        if (raw?.startsWith("```json")) raw = raw.replace(/```json|```/g, "").trim()

        const categories = JSON.parse(raw!)
        return Response.json({ categories })
    } catch (err: any) {
        console.error("Categorization API error:", err)
        return new Response(JSON.stringify({ error: err.message || "Failed to categorize interventions" }), {
            status: 500,
        })
    }
}
