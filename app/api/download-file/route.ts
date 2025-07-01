import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const filePath = url.searchParams.get("path")
        const fileName = url.searchParams.get("name")
        const fileId = url.searchParams.get("id")

        console.log("Download reqiuest for file id ", fileId)
        console.log("Download reqiuest for file name ", fileName)

        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

        // Check authentication
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let resolvedPath = filePath
        let resolvedName = fileName

        // 🧠 Support ID-based lookup if `id` is passed
        if (fileId && !filePath) {
            const { data: fileRecord, error } = await supabase
                .from("patient_files")
                .select("file_path, file_name")
                .eq("id", fileId)
                .single()

            if (error || !fileRecord) {
                return NextResponse.json({ error: "File not found for given ID" }, { status: 404 })
            }

            resolvedPath = fileRecord.file_path
            resolvedName = fileRecord.file_name
        }

        if (!resolvedPath) {
            return NextResponse.json({ error: "File path or ID is required" }, { status: 400 })
        }

        const { data, error: downloadError } = await supabase.storage
            .from("nursing-home-files")
            .download(resolvedPath)

        if (downloadError || !data) {
            return NextResponse.json({ error: downloadError?.message || "Failed to download" }, { status: 500 })
        }

        const response = new NextResponse(data)
        response.headers.set("Content-Type", data.type)
        response.headers.set(
            "Content-Disposition",
            `attachment; filename="${resolvedName || "download"}"`
        )

        return response
    } catch (error: any) {
        console.error("Download error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
