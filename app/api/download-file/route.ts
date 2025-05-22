import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const filePath = url.searchParams.get("path")
        const fileName = url.searchParams.get("name")

        if (!filePath) {
            return NextResponse.json({ error: "File path is required" }, { status: 400 })
        }

        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

        // Check authentication
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Download the file
        const { data, error } = await supabase.storage.from("nursing-home-files").download(filePath)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Create response with the file
        const response = new NextResponse(data)

        // Set appropriate headers
        response.headers.set("Content-Type", data.type)
        response.headers.set("Content-Disposition", `attachment; filename="${fileName || "download"}"`)

        return response
    } catch (error: any) {
        console.error("Download error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
