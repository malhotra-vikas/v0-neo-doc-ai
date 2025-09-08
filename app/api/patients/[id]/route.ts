// app/api/patients/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params

        if (!id) {
            return NextResponse.json(
                { error: "Missing patient id" },
                { status: 400 }
            )
        }

        const { error } = await supabase
            .from("patients")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("Error deleting patient:", error)
            return NextResponse.json(
                { error: "Failed to delete patient" },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error(err)
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        )
    }
}
