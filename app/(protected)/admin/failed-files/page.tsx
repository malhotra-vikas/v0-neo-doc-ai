import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
    FileText,
    AlertTriangle,
    Users,
    Building2,
    Calendar,
} from "lucide-react"
import { AutoRefreshWrapper } from "@/components/auto-refresh-wrapper"
import { PageViewLogger } from "@/components/page-view-logger"
import { FailedFilesTable } from "@/components/failed-files-table"

interface FailedFile {
    id: string
    file_name: string
    file_type: string
    file_path: string
    month: string
    year: string
    created_at: string
    processing_status: string
    patient_id: string
    patients: {
        id: string
        name: string
        nursing_home_id: string
        nursing_homes: {
            id: string
            name: string
        } | null
    } | null
}

export default async function FailedFilesPage() {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // Fetch failed files with patient and nursing home info
    // Supabase has a hard limit of 1000 rows, so we need to paginate
    const BATCH_SIZE = 1000
    let allFailedFiles: any[] = []
    let hasMore = true
    let offset = 0

    while (hasMore) {
        const { data: batch, error: batchError } = await supabase
            .from("patient_files")
            .select(`
                id,
                file_name,
                file_type,
                file_path,
                month,
                year,
                created_at,
                processing_status,
                patient_id,
                patients (
                    id,
                    name,
                    nursing_home_id,
                    nursing_homes (
                        id,
                        name
                    )
                )
            `)
            .ilike("parsed_text", "%Python extraction failed%")
            .order("created_at", { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1)

        if (batchError) {
            console.error("Error fetching failed files batch:", batchError)
            break
        }

        if (batch && batch.length > 0) {
            allFailedFiles = [...allFailedFiles, ...batch]
            offset += BATCH_SIZE
            hasMore = batch.length === BATCH_SIZE
        } else {
            hasMore = false
        }
    }

    const failedFiles = allFailedFiles
    const error = null

    console.log("=== FAILED FILES DEBUG ===")
    console.log("Total batches fetched, total count:", failedFiles?.length)
    console.log("=== END DEBUG ===")

    const files = (failedFiles || []) as unknown as FailedFile[]

    // Calculate stats
    const totalFiles = files.length
    const uniquePatients = new Set(files.map((f) => f.patient_id)).size
    const uniqueNursingHomes = new Set(
        files.map((f) => f.patients?.nursing_home_id).filter(Boolean)
    ).size

    // Group by month/year
    const monthYearCounts = files.reduce((acc, file) => {
        const key = `${file.month} ${file.year}`
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="flex flex-col min-h-screen">
            <PageViewLogger user={session.user} pageName="Failed Files" entityType="failed_files" entityId="admin" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <AutoRefreshWrapper userId={session.user.id} pageName="Failed Files">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Failed File Extractions</h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    View and reprocess files where PDF text extraction failed
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-4 mb-8">
                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Failed Files</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-red-600">{totalFiles}</p>
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Affected Patients</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-amber-600">{uniquePatients}</p>
                                    <Users className="h-5 w-5 text-amber-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Nursing Homes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-blue-600">{uniqueNursingHomes}</p>
                                    <Building2 className="h-5 w-5 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Most Affected Period</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-lg font-bold text-slate-600">
                                        {Object.entries(monthYearCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                                    </p>
                                    <Calendar className="h-5 w-5 text-slate-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-white shadow-sm border-slate-200">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl text-slate-800 flex items-center">
                                        <FileText className="mr-2 h-5 w-5 text-red-500" />
                                        Failed Files
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {totalFiles > 0 ? (
                                            <>
                                                {totalFiles} files with extraction failures across {uniquePatients} patients
                                            </>
                                        ) : (
                                            <>No failed files found</>
                                        )}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <FailedFilesTable files={files} />
                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t px-6 py-3">
                            <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
                                <div>
                                    Showing {totalFiles} failed files
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
