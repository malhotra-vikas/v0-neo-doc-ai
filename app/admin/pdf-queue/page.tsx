import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    ChevronLeft,
    FileText,
    Clock,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    Search,
    Filter,
    ArrowUpDown,
    FileSearch,
    Loader2,
    Calendar,
} from "lucide-react"
import { ProcessQueueButton } from "@/components/process-queue-button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AutoRefreshWrapper } from "@/components/auto-refresh-wrapper"
import { PageViewLogger } from "@/components/page-view-logger"

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
        .select("*, patient_files(file_name, patient_id, patient:patients(name))")
        .order("created_at", { ascending: false })
        .limit(50)

    // Get counts by status
    const pendingCount = queueItems?.filter((item) => item.status === "pending").length || 0
    const processingCount = queueItems?.filter((item) => item.status === "processing").length || 0
    const completedCount = queueItems?.filter((item) => item.status === "completed").length || 0
    const failedCount = queueItems?.filter((item) => item.status === "failed").length || 0
    const totalCount = queueItems?.length || 0

    // Get the date range
    const dates = queueItems?.map((item) => new Date(item.created_at)) || []
    const oldestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date()
    const newestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date()

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />
            <PageViewLogger user={session.user} pageName="PDF Queue" entityType="pdf_queue" entityId="admin" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <AutoRefreshWrapper userId={session.user.id} pageName="PDF Queue">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">PDF Processing Queue</h1>
                                <p className="text-sm text-muted-foreground mt-1">Manage and monitor PDF text extraction processing</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ProcessQueueButton />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-5 mb-8">
                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Files</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold">{totalCount}</p>
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
                                    <Clock className="h-5 w-5 text-amber-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-blue-600">{processingCount}</p>
                                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-green-600">{completedCount}</p>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-red-600">{failedCount}</p>
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-white shadow-sm border-slate-200">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl text-slate-800 flex items-center">
                                        <FileSearch className="mr-2 h-5 w-5 text-primary" />
                                        Queue Items
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {totalCount > 0 ? (
                                            <>
                                                Showing {totalCount} items from {formatDate(oldestDate)} to {formatDate(newestDate)}
                                            </>
                                        ) : (
                                            <>No items in the processing queue</>
                                        )}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input type="search" placeholder="Search files..." className="pl-9 h-9 md:w-[200px] lg:w-[300px]" />
                                    </div>
                                    <Select defaultValue="all">
                                        <SelectTrigger className="h-9 w-[130px]">
                                            <Filter className="h-4 w-4 mr-2" />
                                            <SelectValue placeholder="Filter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="processing">Processing</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs defaultValue="all" className="w-full">
                                <TabsList className="w-full rounded-none justify-start border-b bg-slate-50">
                                    <TabsTrigger value="all" className="data-[state=active]:bg-white">
                                        All
                                        <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">
                                            {totalCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="pending" className="data-[state=active]:bg-white">
                                        Pending
                                        <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
                                            {pendingCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="processing" className="data-[state=active]:bg-white">
                                        Processing
                                        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                                            {processingCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="completed" className="data-[state=active]:bg-white">
                                        Completed
                                        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                                            {completedCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="failed" className="data-[state=active]:bg-white">
                                        Failed
                                        <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800">
                                            {failedCount}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <div className="p-0">
                                    <TabsContent value="all" className="m-0">
                                        <QueueItemsTable items={queueItems || []} />
                                    </TabsContent>
                                    <TabsContent value="pending" className="m-0">
                                        <QueueItemsTable items={(queueItems || []).filter((item) => item.status === "pending")} />
                                    </TabsContent>
                                    <TabsContent value="processing" className="m-0">
                                        <QueueItemsTable items={(queueItems || []).filter((item) => item.status === "processing")} />
                                    </TabsContent>
                                    <TabsContent value="completed" className="m-0">
                                        <QueueItemsTable items={(queueItems || []).filter((item) => item.status === "completed")} />
                                    </TabsContent>
                                    <TabsContent value="failed" className="m-0">
                                        <QueueItemsTable items={(queueItems || []).filter((item) => item.status === "failed")} />
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t px-6 py-3">
                            <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
                                <div>
                                    Showing {totalCount} of {totalCount} items
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Last updated: {new Date().toLocaleString()}
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                </AutoRefreshWrapper>
            </main>
        </div>
    )
}

interface QueueItem {
    id: string
    file_id: string
    file_path: string
    status: "pending" | "processing" | "completed" | "failed"
    created_at: string
    processed_at: string | null
    patient_files: {
        file_name: string
        patient_id: string
        patient?: {
            name: string
        }
    } | null
}

function QueueItemsTable({ items }: { items: QueueItem[] }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[40%]">
                            <div className="flex items-center">
                                File
                                <ArrowUpDown className="ml-2 h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="w-[15%]">
                            <div className="flex items-center">Patient</div>
                        </TableHead>
                        <TableHead className="w-[15%]">
                            <div className="flex items-center">
                                Status
                                <ArrowUpDown className="ml-2 h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="w-[15%]">
                            <div className="flex items-center">
                                Created
                                <ArrowUpDown className="ml-2 h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="w-[15%]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                <p>No items found</p>
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item) => (
                            <TableRow key={item.id} className="group">
                                <TableCell className="font-medium">
                                    <div className="flex items-center">
                                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <span className="truncate max-w-[250px]">{item.patient_files?.file_name || "Unknown file"}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{item.patient_files?.patient?.name || "Unknown patient"}</TableCell>
                                <TableCell>
                                    {item.status === "completed" ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Completed
                                        </Badge>
                                    ) : item.status === "failed" ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Failed
                                        </Badge>
                                    ) : item.status === "processing" ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            Processing
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                            <Clock className="h-3 w-3 mr-1" />
                                            Pending
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-xs">{new Date(item.created_at).toLocaleDateString()}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(item.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.patient_files?.patient_id && (
                                            <Button variant="outline" size="sm" asChild className="h-8">
                                                <Link href={`/patients/${item.patient_files.patient_id}/files/${item.file_id}/view`}>
                                                    <FileSearch className="h-3 w-3 mr-1" />
                                                    View
                                                </Link>
                                            </Button>
                                        )}
                                        {item.status === "failed" && (
                                            <Button variant="outline" size="sm" className="h-8">
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                                Retry
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
