"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { FileDownIcon, FileIcon, FileTextIcon, Loader2 } from "lucide-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { logAuditEvent } from "@/lib/audit-logger"
import { PrinterIcon } from "lucide-react"
import { exportToPDF, exportToDOCX } from "@/lib/export-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format as dateformat } from "date-fns"
import { jsPDF } from "jspdf"
import { useReactToPrint } from "react-to-print"
import { useToast } from "@/hooks/use-toast"

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

interface NursingHome {
    id: string
    name: string
}

interface CaseStudyHighlight {
    id: string
    patient_id: string
    file_id?: string
    highlight_text: string
    interventions?: string[]
    outcomes?: string[]
    clinical_risks?: string[]
    created_at: string
    patient_name?: string
    file_name?: string
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
    const reportRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    const [categorizedInterventions, setCategorizedInterventions] = useState<Record<string, string[]>>({})

    // Add patient selection state
    const [selectedPatients, setSelectedPatients] = useState<string[]>([])
    const [availablePatients, setAvailablePatients] = useState<{ id: string; name: string; created_at: string }[]>([])
    const [useAISelection, setUseAISelection] = useState(false)
    const [isLoadingPatients, setIsLoadingPatients] = useState(false)
    const [isAISelecting, setIsAISelecting] = useState(false)

    // Add effect to fetch patients when nursing home changes
    useEffect(() => {
        if (selectedNursingHomeId && selectedMonth && selectedYear) {
            fetchAvailablePatients()
        } else {
            setAvailablePatients([])
            setSelectedPatients([])
        }
    }, [selectedNursingHomeId, selectedMonth, selectedYear])

    const fetchAvailablePatients = async () => {
        if (!selectedNursingHomeId) return

        setIsLoadingPatients(true)
        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const endDate = new Date(Number.parseInt(selectedYear), monthNumber, 0).toISOString().split("T")[0] // Last day of month

            const { data: patients, error } = await supabase
                .from("patients")
                .select("id, name, created_at")
                .eq("nursing_home_id", selectedNursingHomeId)
                .gte("created_at", startDate)
                .lte("created_at", endDate)
                .order("name")

            if (error) throw error

            setAvailablePatients(patients || [])
            // Reset selections when nursing home changes
            setSelectedPatients([])
            setUseAISelection(false)
        } catch (error) {
            console.error("Error fetching patients:", error)
            toast({
                title: "Error",
                description: "Failed to fetch patients. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingPatients(false)
        }
    }

    const handleAIPatientSelection = async () => {
        if (!selectedNursingHomeId || availablePatients.length === 0) return

        setIsAISelecting(true)
        try {
            const supabase = createClientComponentClient()

            // Get patients with their file counts and recent activity
            const { data: patientsWithFiles, error } = await supabase
                .from("patients")
                .select(`
                id, 
                name, 
                created_at,
                patient_files(id, created_at)
            `)
                .eq("nursing_home_id", selectedNursingHomeId)

            if (error) throw error

            console.log("patientsWithFiles is ", patientsWithFiles)

            // AI selection criteria
            const selectedPatientIds =
                patientsWithFiles
                    ?.filter((patient) => {
                        const files = patient.patient_files || []
                        const recentFiles = files.filter((file) => {
                            const fileDate = new Date(file.created_at)
                            const monthsAgo = new Date()
                            monthsAgo.setMonth(monthsAgo.getMonth() - 3)
                            return fileDate >= monthsAgo
                        })

                        // Select patients with recent activity and multiple files
                        return recentFiles.length > 0 && files.length >= 2
                    })
                    .sort((a, b) => {
                        const aFiles = a.patient_files?.length || 0
                        const bFiles = b.patient_files?.length || 0
                        return bFiles - aFiles
                    })
                    .slice(0, Math.min(10, Math.ceil(availablePatients.length * 0.3)))
                    .map((p) => p.id) || []

            setSelectedPatients(selectedPatientIds)

            // Log AI selection
            const user = await supabase.auth.getUser()
            if (user.data?.user) {
                logAuditEvent({
                    user: user.data.user,
                    actionType: "ai_patient_selection",
                    entityType: "report",
                    entityId: selectedNursingHomeId,
                    details: {
                        nursing_home_id: selectedNursingHomeId,
                        selected_patients_count: selectedPatientIds.length,
                        total_patients_count: availablePatients.length,
                        selection_criteria: "recent_activity_and_file_count",
                    },
                })
            }

            toast({
                title: "AI Selection Complete",
                description: `Selected ${selectedPatientIds.length} patients based on recent activity and documentation.`,
            })
        } catch (error) {
            console.error("Error with AI patient selection:", error)
            toast({
                title: "AI Selection Failed",
                description: "Failed to select patients automatically. Please try manual selection.",
                variant: "destructive",
            })
        } finally {
            setIsAISelecting(false)
        }
    }

    const handlePatientToggle = (patientId: string) => {
        setSelectedPatients((prev) =>
            prev.includes(patientId) ? prev.filter((id) => id !== patientId) : [...prev, patientId],
        )
    }

    const handleSelectAllPatients = () => {
        setSelectedPatients(availablePatients.map((p) => p.id))
    }

    const handleDeselectAllPatients = () => {
        setSelectedPatients([])
    }

    // Replace the existing fetchCaseStudies function with this updated version
    const fetchCaseStudies = async () => {
        if (!selectedNursingHomeId) return

        setIsLoadingCaseStudies(true)

        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const endDate = new Date(Number.parseInt(selectedYear), monthNumber, 0).toISOString().split("T")[0]

            // Use selected patients or all patients if none selected
            const patientIds = selectedPatients.length > 0 ? selectedPatients : availablePatients.map((p) => p.id)

            if (patientIds.length === 0) {
                setCaseStudies([])
                setIsLoadingCaseStudies(false)
                return
            }

            // Get case studies for selected patients in the date range
            const { data, error } = await supabase
                .from("patient_case_study_highlights")
                .select(`
                    id, 
                    patient_id, 
                    highlight_text, 
                    interventions,
                    outcomes,
                    clinical_risks,
                    created_at
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
                const patient = availablePatients.find((p) => p.id === cs.patient_id)
                return {
                    id: cs.id,
                    patient_id: cs.patient_id,
                    highlight_text: cs.highlight_text,
                    interventions: cs.interventions,
                    outcomes: cs.outcomes,
                    clinical_risks: cs.clinical_risks,
                    created_at: cs.created_at,
                    patient_name: patient?.name || "Unknown Patient",
                }
            })

            setCaseStudies(formattedCaseStudies)

            // Now categorize interventions
            const allInterventions = [
                ...new Set(
                    formattedCaseStudies
                        .flatMap((cs) => cs.interventions || [])
                        .filter(Boolean)
                ),
            ]

            if (allInterventions.length > 0) {
                console.log("BEfore categorization - allInterventions - ", allInterventions)
                const categorized = await categorizeInterventionsWithOpenAI(allInterventions)
                setCategorizedInterventions(categorized)
            }

        } catch (error: any) {
            console.error("Error fetching case studies:", error?.message || error || "Unknown error")

            toast({
                title: "Error",
                description: "Failed to fetch case studies. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingCaseStudies(false)
        }
    }

    const handleGenerateReport = async () => {
        setIsGenerating(true)
        setReportGenerated(false)
        try {
            await fetchCaseStudies()
            setReportGenerated(true)
            toast({
                title: "Report Generated",
                description: "The report has been generated successfully.",
            })
        } catch (error) {
            console.error("Error generating report:", error)
            toast({
                title: "Error",
                description: "Failed to generate report. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsGenerating(false)
        }
    }

    const handlePrint = useCallback(async () => {
        try {
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)
            
            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            // Use the exportToPDF function to generate a PDF blob
            const result = await exportToPDF({ 
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies,
                logoPath: '/puzzle_background.png',
                categorizedInterventions,
                returnBlob: true
            });
            
            if (!result || !(result instanceof Blob)) {
                throw new Error('Failed to generate PDF blob');
            }

            // Create a URL for the blob
            const pdfUrl = URL.createObjectURL(result)
            
            // Open PDF in new window
            const printWindow = window.open(pdfUrl, '_blank')
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print()
                    // Clean up the blob URL after printing
                    URL.revokeObjectURL(pdfUrl)
                }
            }
        } catch (error) {
            console.error('Error generating print PDF:', error)
            toast({
                title: "Error",
                description: "Failed to prepare document for printing.",
                variant: "destructive",
            })
        }
    }, [nursingHomes, selectedNursingHomeId, selectedMonth, selectedYear, caseStudies, categorizedInterventions, toast])

    const handleExportPDF = async () => {
        try {
            setIsExporting(true)
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)
            
            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            // Use the exportToPDF function from export-utils
            await exportToPDF({ 
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies,
                logoPath: '/puzzle_background.png',
                categorizedInterventions
            })

            toast({
                title: "Success",
                description: "Report exported as PDF successfully.",
            })
        } catch (error) {
            console.error('Error exporting PDF:', error)
            toast({
                title: "Error",
                description: "Failed to export report as PDF.",
                variant: "destructive",
            })
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportDOCX = async () => {
        try {
            setIsExporting(true);
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId);
            
            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found');
            }
            await exportToDOCX({ 
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies,
                logoPath: '/puzzle_background.png',
                categorizedInterventions,
                returnBlob: false 
            });

            toast({
                title: "Success",
                description: "Report exported as DOCX successfully.",
            });
        } catch (error) {
            console.error('Error exporting DOCX:', error);
            toast({
                title: "Error",
                description: "Failed to export report as DOCX.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const formatDate = (date: Date): string => {
        return dateformat(date, "PPP")
    }

    async function categorizeInterventionsWithOpenAI(interventions: string[]) {
        const prompt = `
Given the following list of healthcare interventions, first normalize the interventions by grouping similar or redundant entries together (e.g., "Care Coordination", "Coordination of Care by dedicated manager", "Care Team coordination" should all be grouped under "Care Coordination"). 
Preserve the source quotes and source_file_ids under each grouped entry.

Then, categorize each **normalized intervention** into one of these subcategories:

- Transitional Support
- Engagement & Education
- Care Navigation
- Rehabilitation & Mobility Support
- Behavioral & Psychosocial Support
- Nutrition & Functional Recovery
- Clinical Risk Management

Respond with structured JSON:
{
  "Transitional Support": [...],
  "Clinical Risk Management": [...],
  "Engagement & Education": [...],
  "Care Navigation": [...],
  "Rehabilitation & Mobility Support": [...],
  "Behavioral & Psychosocial Support": [...],
  "Nutrition & Functional Recovery": [...]
}

Interventions:
${interventions.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}
`

        const response = await fetch("/api/openai-categorize", {
            method: "POST",
            body: JSON.stringify({ prompt }),
            headers: { "Content-Type": "application/json" },
        })

        const json = await response.json()
        console.log("Sub Categorization respons eis ", json)
        return json.categories
    }

    const getPatientInitials = (name: string): string => {
        const nameParts = name.split(" ")
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join("")
        return initials
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Generate Report</CardTitle>
                    <CardDescription>Select the nursing home, month, and year to generate a report.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="nursing-home">Nursing Home</Label>
                            <Select onValueChange={setSelectedNursingHomeId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a nursing home" />
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
                        </div>
                        <div>
                            <Label htmlFor="month">Month</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((month) => (
                                        <SelectItem key={month} value={month}>
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="year">Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {selectedNursingHomeId && (
                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium">Patient Selection</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Choose Specific Patients for this report or use AI to auto-select relevant patients.
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="useAI"
                                        checked={useAISelection}
                                        onChange={(e) => {
                                            setUseAISelection(e.target.checked)
                                            if (e.target.checked) {
                                                handleAIPatientSelection()
                                            }
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    <Label htmlFor="useAI" className="text-sm">
                                        Use AI Selection
                                    </Label>
                                </div>
                            </div>

                            {isLoadingPatients ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : availablePatients.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            {selectedPatients.length} of {availablePatients.length} patients selected
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSelectAllPatients}
                                                disabled={selectedPatients.length === availablePatients.length}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleDeselectAllPatients}
                                                disabled={selectedPatients.length === 0}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                    </div>

                                    {useAISelection && isAISelecting && (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            <span className="text-sm">AI is selecting relevant patients...</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                        {availablePatients.map((patient) => (
                                            <div
                                                key={patient.id}
                                                className="flex items-center space-x-2 p-2 rounded border bg-white hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={`patient-${patient.id}`}
                                                    checked={selectedPatients.includes(patient.id)}
                                                    onChange={() => handlePatientToggle(patient.id)}
                                                    className="rounded border-gray-300"
                                                />
                                                <Label htmlFor={`patient-${patient.id}`} className="text-sm cursor-pointer flex-1 truncate">
                                                    {patient.name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No patients found for this nursing home.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                    <div>
                        {caseStudies.length > 0 && (
                            <p className="text-sm text-muted-foreground">Found {caseStudies.length} case studies</p>
                        )}
                    </div>
                    <Button
                        onClick={handleGenerateReport}
                        disabled={
                            !selectedNursingHomeId || isGenerating || (availablePatients.length > 0 && selectedPatients.length === 0)
                        }
                        className="min-w-[150px]"
                    >
                        {isGenerating ? (
                            <>
                                Generating <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            </>
                        ) : (
                            "Generate Report"
                        )}
                    </Button>
                </CardFooter>
            </Card>

            {/* Report Preview */}
            {reportGenerated && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle>Report Preview</CardTitle>
                            <CardDescription>A preview of the generated report.</CardDescription>
                            {selectedPatients.length > 0 && selectedPatients.length < availablePatients.length && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Report includes {selectedPatients.length} selected patients
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isGenerating}>
                                <PrinterIcon className="h-4 w-4 mr-2" />
                                Print
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={isExporting}>
                                        <FileDownIcon className="h-4 w-4 mr-2" />
                                        {isExporting ? (
                                            <>
                                                Exporting <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                            </>
                                        ) : (
                                            "Export"
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="border border-border shadow-md p-1 rounded-md">
                                    <DropdownMenuItem onClick={handleExportPDF}>
                                        <FileTextIcon className="h-4 w-4 mr-2" />
                                        Export as PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportDOCX}>
                                        <FileIcon className="h-4 w-4 mr-2" />
                                        Export as DOCX
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Tabs defaultValue="preview" className="w-full space-y-4">
                            <TabsContent value="preview" className="space-y-4">
                                <div ref={reportRef} className="space-y-4">

                                    {/* Patient Snapshot Overview: 30-Day Readmissions */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">(WORK IN PROGRESS) Patient Snapshot Overview: 30-Day Readmissions</h3>
                                    </div>

                                    {/* Interventions Section */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">🧰 Interventions Delivered</h3>
                                        {Object.entries(categorizedInterventions)
                                            .filter(([_, items]) => items.length > 0)
                                            .map(([subcategory, items]) => (
                                                <div key={subcategory} className="mb-4">
                                                    <h4 className="text-md font-semibold">{subcategory}</h4>
                                                    <ul className="list-disc list-inside ml-4 text-sm">
                                                        {items.map((item, index) => (
                                                            <li key={index}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                    </div>

                                    {/* Puzzle TouchPoint Summary Section */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">(WORK IN PROGRESS) Puzzle Touchpoints</h3>
                                    </div>

                                    {/* Outcomes Section */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">📈 Key Interventions and Outcomes</h3>
                                        <ul className="list-disc list-inside ml-4 text-sm">
                                            {[
                                                ...new Set(
                                                    caseStudies
                                                        .flatMap((study) => study.outcomes || [])
                                                        .filter(Boolean)
                                                ),
                                            ].map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Clinical Risks Section */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">⚠️ Top Clinical Risks Identified at Discharge</h3>
                                        <ul className="list-disc list-inside ml-4 text-sm">
                                            {[
                                                ...new Set(
                                                    caseStudies
                                                        .flatMap((study) => study.clinical_risks || [])
                                                        .filter(Boolean)
                                                ),
                                            ]
                                                .slice(0, 30) // Optional: limit for readability
                                                .map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                        </ul>
                                        {caseStudies.flatMap((s) => s.clinical_risks || []).length > 30 && (
                                            <p className="text-xs italic text-muted-foreground mt-2">Showing top 30 risks. Refine in filters for more detail.</p>
                                        )}
                                    </div>

                                    {caseStudies.length > 0 ? (
                                        caseStudies.map((study) => (
                                            <div key={study.id} className="border rounded-md p-4">
                                                <p className="text-sm font-medium">{study.patient_name}</p>
                                                <p className="text-sm mt-2">{study.highlight_text}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-4 text-sm text-muted-foreground">
                                            No case studies found for the selected criteria.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
