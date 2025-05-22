import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, FileText, Download, RefreshCw } from "lucide-react"
import { ReprocessButton } from "@/components/reprocess-button"
import { PageViewLogger } from "@/components/page-view-logger"

export default async function ViewParsedTextPage({ params }: { params: { id: string; fileId: string } }) {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

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

    // Check if there's a queue item for this file
    const { data: queueItem } = await supabase
        .from("pdf_processing_queue")
        .select("*")
        .eq("file_id", params.fileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />
            <PageViewLogger
                user={session.user}
                pageName="View Patient File"
                entityType="patient_file"
                entityId={params.fileId}
            />

            <main className="flex-1 container mx-auto py-6 px-4">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Button variant="ghost" size="sm" asChild className="mr-4">
                            <Link href={`/patients/${params.id}/files`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back to Files
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold">Parsed Text: {file.file_name}</h1>
                    </div>
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/api/download-file?path=${encodeURIComponent(file.file_path)}&name=${encodeURIComponent(
                                    file.file_name,
                                )}`}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Original
                            </Link>
                        </Button>
                        <ReprocessButton fileId={params.fileId} />
                    </div>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>File Information</CardTitle>
                        <CardDescription>Details about the PDF file and its processing status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">File Name</h3>
                                <p className="mt-1 flex items-center">
                                    <FileText className="h-4 w-4 mr-2 text-red-500" />
                                    {file.file_name}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">Upload Date</h3>
                                <p className="mt-1">{new Date(file.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">Processing Status</h3>
                                <p className="mt-1">
                                    {file.processing_status === "completed" ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Processed Successfully
                                        </span>
                                    ) : file.processing_status === "failed" ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            Processing Failed
                                        </span>
                                    ) : file.processing_status === "processing" ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            Processing
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            Pending
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Extracted Text Content</CardTitle>
                        <CardDescription>
                            Text extracted from {file.file_name} for {patient.name}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {file.processing_status === "completed" ? (
                            <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md border max-h-[70vh] overflow-y-auto font-mono text-sm">
                                {file.parsed_text || "No text content was extracted from this file."}
                            </div>
                        ) : file.processing_status === "failed" ? (
                            <div className="bg-red-50 p-4 rounded-md border text-red-800">
                                <p className="font-medium">Processing failed for this file.</p>
                                <p className="mt-2">The system was unable to extract text from this PDF. This could be due to:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>The PDF contains only scanned images without OCR</li>
                                    <li>The PDF is password protected or encrypted</li>
                                    <li>The file is corrupted or in an unsupported format</li>
                                </ul>
                                <p className="mt-4">You can try reprocessing the file using the button above.</p>
                            </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-md border text-blue-800">
                                <div className="flex items-center">
                                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                    This file is still being processed. Please check back later.
                                </div>
                                <p className="mt-2 text-sm">Processing time depends on the size and complexity of the PDF file.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
