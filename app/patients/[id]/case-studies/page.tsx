import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, FileText, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PatientCaseStudiesPage({
    params,
}: {
    params: { id: string }
}) {
    const supabase = createServerComponentClient({ cookies })

    // Get the patient data
    const { data: patient, error } = await supabase.from("patients").select("*").eq("id", params.id).single()

    if (error || !patient) {
        notFound()
    }

    // Get all case study highlights for this patient
    const { data: caseStudies } = await supabase
        .from("case_study_highlights")
        .select(`
      id,
      highlight_text,
      created_at,
      patient_files (
        id,
        file_name,
        file_type,
        month,
        year
      )
    `)
        .eq("patient_id", params.id)
        .order("created_at", { ascending: false })

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/patients/${params.id}`}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Patient
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Case Study Highlights for {patient.name}</h1>
            </div>

            {caseStudies && caseStudies.length > 0 ? (
                <div className="grid gap-6">
                    {caseStudies.map((caseStudy) => (
                        <Card key={caseStudy.id}>
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            Case Study from {caseStudy.patient_files.month} {caseStudy.patient_files.year}
                                        </CardTitle>
                                        <CardDescription className="mt-1 flex items-center">
                                            <FileText className="h-4 w-4 mr-1" />
                                            {caseStudy.patient_files.file_name}
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/patients/${params.id}/files/${caseStudy.patient_files.id}/view`}>View Source</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{caseStudy.highlight_text}</p>
                                    <div className="text-sm text-gray-500 mt-4">
                                        Generated on {new Date(caseStudy.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Case Study Highlights Yet</h3>
                        <p className="text-gray-500 mb-6 max-w-md">
                            There are no case study highlights generated for this patient yet. Process PDF files and generate case
                            studies from the file view page.
                        </p>
                        <Button asChild>
                            <Link href={`/patients/${params.id}/files`}>View Patient Files</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
