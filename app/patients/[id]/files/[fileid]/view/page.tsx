import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"

export default async function ViewParsedTextPage({ params }: { params: { id: string; fileId: string } }) {
    const supabase = createServerComponentClient({ cookies })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // Fetch patient details
    const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("*, nursing_homes(*)")
        .eq("id", params.id)
        .single()

    if (patientError || !patient) {
        notFound()
    }

    // Fetch file details
    const { data: file, error: fileError } = await supabase
        .from("patient_files")
        .select("*")
        .eq("id", params.fileId)
        .eq("patient_id", params.id)
        .single()

    if (fileError || !file) {
        notFound()
    }

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />

            <main className="flex-1 container mx-auto py-6 px-4">
                <div className="flex items-center mb-6">
                    <Button variant="ghost" size="sm" asChild className="mr-4">
                        <Link href={`/patients/${params.id}/files`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to Files
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold">Parsed Text: {file.file_name}</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Extracted Text Content</CardTitle>
                        <CardDescription>
                            Text extracted from {file.file_name} for {patient.name}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {file.processing_status === "completed" ? (
                            <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md border max-h-[70vh] overflow-y-auto">
                                {file.parsed_text || "No text content was extracted from this file."}
                            </div>
                        ) : file.processing_status === "failed" ? (
                            <div className="bg-red-50 p-4 rounded-md border text-red-800">
                                Processing failed for this file. Please try re-uploading the file.
                            </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-md border text-blue-800">
                                This file is still being processed. Please check back later.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
