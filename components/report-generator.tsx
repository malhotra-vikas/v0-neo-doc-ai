"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    BarChart3,
    FileText,
    Download,
    Calendar,
    Building2,
    AlertCircle,
    Loader2,
    Shield,
    Sparkles,
    ChevronDown,
    ChevronUp,
} from "lucide-react"
import { logAuditEvent } from "@/lib/audit-logger"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/components/ui/use-toast"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"

interface NursingHome {
    id: string
    name: string
}

interface CaseStudyHighlight {
    id: string
    patient_id: string
    file_id: string
    highlight_text: string
    created_at: string
    patient_name: string
    file_name: string
}

interface ReportGeneratorProps {
    nursingHomes: NursingHome[]
}

export function ReportGenerator({ nursingHomes }: ReportGeneratorProps) {
    const [selectedNursingHomeId, setSelectedNursingHomeId] = useState<string>("")
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString("default", { month: "long" }))
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
    const [isGenerating, setIsGenerating] = useState(false)
    const [reportGenerated, setReportGenerated] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [caseStudies, setCaseStudies] = useState<CaseStudyHighlight[]>([])
    const [isLoadingCaseStudies, setIsLoadingCaseStudies] = useState(false)
    const [expandedCaseStudy, setExpandedCaseStudy] = useState<string | null>(null)
    const reportRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()

    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString())

    const selectedNursingHome = nursingHomes.find((home) => home.id === selectedNursingHomeId)

    useEffect(() => {
        // Reset case studies when nursing home or date changes
        setCaseStudies([])
        setReportGenerated(false)
    }, [selectedNursingHomeId, selectedMonth, selectedYear])

    const fetchCaseStudies = async () => {
        if (!selectedNursingHomeId) return

        setIsLoadingCaseStudies(true)

        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const endDate = new Date(Number.parseInt(selectedYear), monthNumber, 0).toISOString().split("T")[0] // Last day of month

            // First get patients for the nursing home
            const { data: patients, error: patientsError } = await supabase
                .from("patients")
                .select("id, name")
                .eq("nursing_home_id", selectedNursingHomeId)

            if (patientsError) {
                throw patientsError
            }

            if (!patients || patients.length === 0) {
                setCaseStudies([])
                setIsLoadingCaseStudies(false)
                return
            }

            // Get patient IDs
            const patientIds = patients.map((p) => p.id)

            // Get case studies for these patients in the date range
            const { data, error } = await supabase
                .from("case_study_highlights")
                .select(`
          id, 
          patient_id, 
          file_id, 
          highlight_text, 
          created_at,
          patient_files(file_name)
        `)
                .in("patient_id", patientIds)
                .gte("created_at", startDate)
                .lte("created_at", endDate)
                .order("created_at", { ascending: false })

            if (error) {
                throw error
            }

            // Format the case studies with patient names
            const formattedCaseStudies = data.map((cs) => {
                const patient = patients.find((p) => p.id === cs.patient_id)
                return {
                    id: cs.id,
                    patient_id: cs.patient_id,
                    file_id: cs.file_id,
                    highlight_text: cs.highlight_text,
                    created_at: cs.created_at,
                    patient_name: patient?.name || "Unknown Patient",
                    file_name: cs.patient_files?.file_name || "Unknown File",
                }
            })

            setCaseStudies(formattedCaseStudies)
        } catch (error) {
            console.error("Error fetching case studies:", error)
            toast({
                title: "Error",
                description: "Failed to fetch case studies. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingCaseStudies(false)
        }
    }

    const handleGenerateReport = () => {
        if (!selectedNursingHomeId) return

        setIsGenerating(true)

        // Fetch case studies and generate report
        fetchCaseStudies().then(() => {
            setTimeout(async () => {
                setIsGenerating(false)
                setReportGenerated(true)

                // Log report generation
                const supabase = createClientComponentClient()
                const user = await supabase.auth.getUser()
                if (user.data?.user) {
                    logAuditEvent({
                        user: user.data.user,
                        actionType: "generate_report",
                        entityType: "report",
                        entityId: `${selectedNursingHomeId}-${selectedMonth}-${selectedYear}`,
                        details: {
                            nursing_home_id: selectedNursingHomeId,
                            nursing_home_name: selectedNursingHome?.name,
                            month: selectedMonth,
                            year: selectedYear,
                            report_type: "monthly",
                            case_studies_count: caseStudies.length,
                        },
                    })
                }
            }, 1500)
        })
    }

    const handlePrint = async () => {
        // Log print action
        const supabase = createClientComponentClient()
        const user = await supabase.auth.getUser()
        if (user.data?.user) {
            logAuditEvent({
                user: user.data.user,
                actionType: "print_report",
                entityType: "report",
                entityId: `${selectedNursingHomeId}-${selectedMonth}-${selectedYear}`,
                details: {
                    nursing_home_id: selectedNursingHomeId,
                    nursing_home_name: selectedNursingHome?.name,
                    month: selectedMonth,
                    year: selectedYear,
                    case_studies_count: caseStudies.length,
                },
            })
        }

        // Expand all case studies for printing
        const previouslyExpanded = expandedCaseStudy
        setExpandedCaseStudy("all")

        // Wait for state update to apply
        setTimeout(() => {
            // Use browser's print functionality
            window.print()

            // Restore previous state after print dialog closes
            setTimeout(() => {
                setExpandedCaseStudy(previouslyExpanded)
            }, 500)
        }, 100)
    }

    const handleExportPDF = async () => {
        if (!reportRef.current) return

        setIsExporting(true)

        try {
            // Log export action
            const supabase = createClientComponentClient()
            const user = await supabase.auth.getUser()
            if (user.data?.user) {
                logAuditEvent({
                    user: user.data.user,
                    actionType: "export_report_pdf",
                    entityType: "report",
                    entityId: `${selectedNursingHomeId}-${selectedMonth}-${selectedYear}`,
                    details: {
                        nursing_home_id: selectedNursingHomeId,
                        nursing_home_name: selectedNursingHome?.name,
                        month: selectedMonth,
                        year: selectedYear,
                        format: "pdf",
                        case_studies_count: caseStudies.length,
                    },
                })
            }

            // Expand all case studies for PDF export
            const previouslyExpanded = expandedCaseStudy
            setExpandedCaseStudy("all")

            // Wait for state update to apply
            await new Promise((resolve) => setTimeout(resolve, 100))

            // Create a clone of the report element to modify for PDF export
            const reportElement = reportRef.current
            const originalPosition = reportElement.style.position
            const originalZIndex = reportElement.style.zIndex

            // Temporarily modify the element for better rendering
            reportElement.style.position = "absolute"
            reportElement.style.zIndex = "-1000"
            reportElement.style.top = "0"
            reportElement.style.left = "0"
            reportElement.style.width = "800px" // Fixed width for PDF

            // Create canvas from the report element
            const canvas = await html2canvas(reportElement, {
                scale: 2, // Higher scale for better quality
                logging: false,
                useCORS: true,
                allowTaint: true,
            })

            // Restore original styles
            reportElement.style.position = originalPosition
            reportElement.style.zIndex = originalZIndex
            reportElement.style.top = ""
            reportElement.style.left = ""
            reportElement.style.width = ""

            // Restore previous expansion state
            setExpandedCaseStudy(previouslyExpanded)

            // Create PDF
            const imgData = canvas.toDataURL("image/png")
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            })

            // Calculate dimensions to fit the image properly on the PDF
            const imgWidth = 210 // A4 width in mm (portrait)
            const imgHeight = (canvas.height * imgWidth) / canvas.width

            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

            // Save the PDF
            const fileName = `${selectedNursingHome?.name || "NursingHome"}_Report_${selectedMonth}_${selectedYear}.pdf`
            pdf.save(fileName)

            toast({
                title: "PDF Exported Successfully",
                description: `Your report has been exported as ${fileName}`,
            })
        } catch (error) {
            console.error("Error exporting PDF:", error)
            toast({
                title: "Export Failed",
                description: "There was an error exporting your report to PDF. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsExporting(false)
        }
    }

    const toggleCaseStudy = (id: string) => {
        if (expandedCaseStudy === id) {
            setExpandedCaseStudy(null)
        } else {
            setExpandedCaseStudy(id)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    return (
        <Card className="w-full shadow-md border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl text-slate-800">Report Generator</CardTitle>
                        <CardDescription className="mt-1">
                            Generate comprehensive reports for nursing homes by month
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Tabs defaultValue="generate" className="w-full">


                    <TabsContent value="generate" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="nursingHome" className="text-sm font-medium">
                                        Nursing Home
                                    </Label>
                                    <span className="text-red-500 ml-1">*</span>
                                </div>
                                <Select value={selectedNursingHomeId} onValueChange={setSelectedNursingHomeId}>
                                    <SelectTrigger id="nursingHome" className="w-full">
                                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Select nursing home" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {nursingHomes.length === 0 ? (
                                            <div className="p-2 text-center text-sm text-muted-foreground">No nursing homes found</div>
                                        ) : (
                                            nursingHomes.map((home) => (
                                                <SelectItem key={home.id} value={home.id}>
                                                    {home.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Select the nursing home for this report.</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="month" className="text-sm font-medium">
                                        Month
                                    </Label>
                                    <span className="text-red-500 ml-1">*</span>
                                </div>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger id="month" className="w-full">
                                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map((month) => (
                                            <SelectItem key={month} value={month}>
                                                {month}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">The month for this report.</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="year" className="text-sm font-medium">
                                        Year
                                    </Label>
                                    <span className="text-red-500 ml-1">*</span>
                                </div>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger id="year" className="w-full">
                                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Select year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">The year for this report.</p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleGenerateReport}
                                disabled={!selectedNursingHomeId || isGenerating}
                                className="min-w-[150px]"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <BarChart3 className="mr-2 h-4 w-4" />
                                        Generate Report
                                    </>
                                )}
                            </Button>
                        </div>

                        {reportGenerated && (
                            <div className="mt-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">Report Preview</h3>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                                            <FileText className="mr-2 h-4 w-4" />
                                            Print
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportPDF}
                                            disabled={isExporting}
                                            className="print:hidden"
                                        >
                                            {isExporting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Exporting...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Export PDF
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div ref={reportRef} className="report-content">
                                    <Card className="border-dashed">
                                        <CardHeader className="bg-slate-50 border-b">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle>{selectedNursingHome?.name || "Nursing Home"}</CardTitle>
                                                    <CardDescription>
                                                        Monthly Report: {selectedMonth} {selectedYear}
                                                    </CardDescription>
                                                </div>
                                                <Badge variant="outline" className="bg-white">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    Generated: {new Date().toLocaleDateString()}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-6">
           

                                            <div className="space-y-6">

                                                <div className="mt-8">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-sm font-medium">Case Study Highlights</h4>
                                                        <Badge variant="outline" className="bg-white">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            Privacy Protected
                                                        </Badge>
                                                    </div>

                                                    {isLoadingCaseStudies ? (
                                                        <div className="space-y-4">
                                                            <Skeleton className="h-32 w-full" />
                                                            <Skeleton className="h-32 w-full" />
                                                            <Skeleton className="h-32 w-full" />
                                                        </div>
                                                    ) : caseStudies.length === 0 ? (
                                                        <div className="text-center py-8 border rounded-md bg-white">
                                                            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                            <h3 className="text-lg font-medium mb-2">No Case Studies Available</h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                No case studies were found for this nursing home in {selectedMonth} {selectedYear}.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {caseStudies.map((caseStudy) => (
                                                                <Card key={caseStudy.id} className="border overflow-hidden">
                                                                    <div
                                                                        className="bg-gradient-to-r from-slate-50 to-slate-100 border-b px-4 py-3 flex items-center justify-between cursor-pointer"
                                                                        onClick={() => toggleCaseStudy(caseStudy.id)}
                                                                    >
                                                                        <div className="flex items-center">
                                                                            <Sparkles className="h-4 w-4 text-amber-500 mr-2" />
                                                                            <div>
                                                                                <h5 className="font-medium text-sm">
                                                                                    {caseStudy.patient_name
                                                                                        .split(" ")
                                                                                        .map((name) => name.charAt(0) + "." + (name.length > 1 ? " " : ""))
                                                                                        .join("")}
                                                                                </h5>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {formatDate(caseStudy.created_at)} • {caseStudy.file_name}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            {expandedCaseStudy === caseStudy.id || expandedCaseStudy === "all" ? (
                                                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                                            ) : (
                                                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {(expandedCaseStudy === caseStudy.id || expandedCaseStudy === "all") && (
                                                                        <CardContent className="p-4 bg-white">
                                                                            <div className="prose prose-sm max-w-none">
                                                                                <p>{caseStudy.highlight_text}</p>
                                                                            </div>
                                                                        </CardContent>
                                                                    )}
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="mt-4 text-xs text-muted-foreground">
                                                        <p className="flex items-center">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            All case studies are privacy-protected and exclude personally identifiable information.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Recent Reports</h3>
                            <p className="text-sm text-muted-foreground mb-6">Generated reports will appear here for easy access</p>
                            <Button variant="outline" onClick={() => document.querySelector('[data-value="generate"]')?.click()}>
                                Generate a New Report
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t px-6 py-4 print:hidden">
                <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="text-xs text-muted-foreground">
                        <p>
                            Reports include patient statistics, file processing status, monthly metrics, and case study highlights.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedNursingHome && (
                            <Badge variant="outline" className="bg-white">
                                <Building2 className="h-3 w-3 mr-1" />
                                {selectedNursingHome.name}
                            </Badge>
                        )}
                        <Badge variant="outline" className="bg-white">
                            <Calendar className="h-3 w-3 mr-1" />
                            {selectedMonth} {selectedYear}
                        </Badge>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
