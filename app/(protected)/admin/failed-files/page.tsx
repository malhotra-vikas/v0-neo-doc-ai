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
    BookOpen,
} from "lucide-react"
import { AutoRefreshWrapper } from "@/components/auto-refresh-wrapper"
import { PageViewLogger } from "@/components/page-view-logger"
import { FailedFilesTable } from "@/components/failed-files-table"
import { FailedCaseStudiesTable } from "@/components/failed-case-studies-table"

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

export interface FailedCaseStudy {
    id: string
    patient_id: string
    patient_name: string
    nursing_home_name: string | null
    nursing_home_id: string | null
    updated_at: string
    failed_quotes_count: number
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

    console.log("=== FAILED FILES DEBUG ===")
    console.log("Total batches fetched, total count:", failedFiles?.length)
    console.log("=== END DEBUG ===")

    // Fetch case studies with "Python extraction failed" in source quotes
    // We need to fetch all and filter client-side since Supabase doesn't support
    // text search within JSONB array elements directly
    const { data: allCaseStudies, error: caseStudyError } = await supabase
        .from("patient_case_study_highlights")
        .select(`
            id,
            patient_id,
            detailed_interventions,
            detailed_outcomes,
            updated_at,
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
        .order("updated_at", { ascending: false })

    // Filter for case studies that have "Python extraction failed" in their source quotes
    const failedCaseStudiesRaw = (allCaseStudies || []).filter((cs: any) => {
        const interventionsHasFailed = (cs.detailed_interventions || []).some(
            (i: any) => i.source_quote === "Python extraction failed."
        )
        const outcomesHasFailed = (cs.detailed_outcomes || []).some(
            (o: any) => o.source_quote === "Python extraction failed."
        )
        return interventionsHasFailed || outcomesHasFailed
    })

    if (caseStudyError) {
        console.error("Error fetching failed case studies:", caseStudyError)
    }

    // Process case studies to count failed quotes
    const failedCaseStudies: FailedCaseStudy[] = (failedCaseStudiesRaw || []).map((cs: any) => {
        const interventionsFailed = (cs.detailed_interventions || []).filter(
            (i: any) => i.source_quote === "Python extraction failed."
        ).length
        const outcomesFailed = (cs.detailed_outcomes || []).filter(
            (o: any) => o.source_quote === "Python extraction failed."
        ).length

        return {
            id: cs.id,
            patient_id: cs.patient_id,
            patient_name: cs.patients?.name || "Unknown",
            nursing_home_name: cs.patients?.nursing_homes?.name || null,
            nursing_home_id: cs.patients?.nursing_home_id || null,
            updated_at: cs.updated_at,
            failed_quotes_count: interventionsFailed + outcomesFailed,
        }
    }).filter((cs: FailedCaseStudy) => cs.failed_quotes_count > 0)

    console.log("=== FAILED CASE STUDIES DEBUG ===")
    console.log("Total failed case studies:", failedCaseStudies.length)
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

    // Case study stats
    const totalFailedCaseStudies = failedCaseStudies.length
    const uniqueCaseStudyNursingHomes = new Set(
        failedCaseStudies.map((cs) => cs.nursing_home_id).filter(Boolean)
    ).size

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
                                <CardTitle className="text-sm font-medium text-muted-foreground">Failed Case Studies</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-bold text-purple-600">{totalFailedCaseStudies}</p>
                                    <BookOpen className="h-5 w-5 text-purple-500" />
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

                    {/* Failed Case Studies Section */}
                    <Card className="bg-white shadow-sm border-slate-200 mt-8">
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl text-slate-800 flex items-center">
                                        <BookOpen className="mr-2 h-5 w-5 text-purple-500" />
                                        Failed Case Study Quotes
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {totalFailedCaseStudies > 0 ? (
                                            <>
                                                {totalFailedCaseStudies} case studies with &quot;Python extraction failed&quot; quotes across {uniqueCaseStudyNursingHomes} nursing homes
                                            </>
                                        ) : (
                                            <>No case studies with failed quotes found</>
                                        )}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <FailedCaseStudiesTable caseStudies={failedCaseStudies} />
                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t px-6 py-3">
                            <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
                                <div>
                                    Showing {totalFailedCaseStudies} case studies needing regeneration
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
