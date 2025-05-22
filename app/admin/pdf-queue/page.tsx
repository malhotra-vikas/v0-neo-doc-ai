import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft } from "lucide-react"
import { ProcessQueueButton } from "@/components/process-queue-button"

export default async function PDFQueuePage() {
    // Fix: Properly await cookies()
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // Fetch queue items
    const { data: queueItems } = await supabase
        .from("pdf_processing_queue")
        .select("*, patient_files(file_name, patient_id)")
        .order("created_at", { ascending: false })
        .limit(50)

    // Get counts by status
    const pendingCount = queueItems?.filter((item) => item.status === "pending").length || 0
    const processingCount = queueItems?.filter((item) => item.status === "processing").length || 0
    const completedCount = queueItems?.filter((item) => item.status === "completed").length || 0
    const failedCount = queueItems?.filter((item) => item.status === "failed").length || 0

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />

            <main className="flex-1 container mx-auto py-6 px-4">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Button variant="ghost" size="sm" asChild className="mr-4">
                            <Link href="/dashboard">
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold">PDF Processing Queue</h1>
                    </div>
                    <ProcessQueueButton />
                </div>

                <div className="grid gap-6 md:grid-cols-4 mb-8">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{pendingCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Processing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{processingCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{completedCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-red-600">{failedCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Queue Items</CardTitle>
                        <CardDescription>Recent PDF processing queue items</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Processed</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {queueItems?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">
                                            No items in the queue
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    queueItems?.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.patient_files?.file_name || "Unknown file"}</TableCell>
                                            <TableCell>
                                                {item.status === "completed" ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Completed
                                                    </span>
                                                ) : item.status === "failed" ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        Failed
                                                    </span>
                                                ) : item.status === "processing" ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        Processing
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        Pending
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {item.processed_at ? new Date(item.processed_at).toLocaleString() : "Not processed"}
                                            </TableCell>
                                            <TableCell>
                                                {item.patient_files?.patient_id && (
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/patients/${item.patient_files.patient_id}/files/${item.file_id}/view`}>
                                                            View Result
                                                        </Link>
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
