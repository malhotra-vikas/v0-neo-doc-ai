"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FileDownIcon, FileIcon, FileTextIcon, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { logAuditEvent } from "@/lib/audit-logger"
import { PrinterIcon } from "lucide-react"
import { exportToPDF, exportToDOCX } from "@/lib/export-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format as dateformat } from "date-fns"
import * as XLSX from 'xlsx'

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LabelList,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { processPatientsWithLimit } from "@/app/actions/generate-case-study"

const facilityNameMap: Record<string, { patientsName: string; readmitName: string }> = {
    "Harborview Briarwood": {
        patientsName: "Briarwood Health Center by Harborview, LLC.",
        readmitName: "Harborview Briarwood"
    },
    // Add more mappings here as needed
}

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
    highlight_text: string
    facility_summary_text: string
    engagement_summary_text: string
    hospital_discharge_summary_text: string
    highlight_quotes?: { quote: string; source_file_id: string }[]
    hospital_discharge_summary_quotes?: { quote: string; source_file_id: string }[]
    facility_summary_quotes?: { quote: string; source_file_id: string }[]
    engagement_summary_quotes?: { quote: string; source_file_id: string }[]
    interventions?: string[]
    outcomes?: string[]
    clinical_risks?: string[]
    detailed_interventions?: { intervention: string; source_quote: string; source_file_id: string }[]
    detailed_outcomes?: { outcome: string; source_quote: string; source_file_id: string }[]
    detailed_clinical_risks?: { risk: string; source_quote: string; source_file_id: string }[]
    created_at: string
    patient_name?: string
}

interface ReportGeneratorProps {
    nursingHomes: NursingHome[]
}

export function Citations({ label, quotes }: { label: string; quotes: any[] }) {
    if (!quotes || quotes.length === 0) return null

    return (
        <div className="mt-2 ml-2">
            {quotes.map((q, index) => {
                let fileLink = null

                if (q.source_file_id) {
                    fileLink = `/api/download-file?id=${q.source_file_id}`
                }

                return (
                    <div key={index} className="mb-1 text-xs text-gray-600">
                        <span className="italic">"{q.quote}"</span>
                        {fileLink && (
                            <span>
                                &nbsp;(
                                <a
                                    href={fileLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-blue-600 hover:text-blue-800"
                                >
                                    {label}
                                </a>
                                )
                            </span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

async function getFacilitySummary(nursingHomeId: string, month: string, year: string) {
    const supabase = createClientComponentClient()

    console.log("Running getFacilitySummary for - ", nursingHomeId)
    console.log("Running getFacilitySummary for - ", month)
    console.log("Running getFacilitySummary for - ", year)

    const { data, error } = await supabase
        .from('facility_readmission_summary')
        .select('*')
        .eq('nursing_home_id', nursingHomeId)
        .eq('month', month)
        .eq('year', year)
        .single() // returns one row instead of array        

    console.log("getFacilitySummary Data is - ", data)

    if (error) {
        console.error("❌ Failed to fetch facility summary:", error)
        return null
    }

    return data
}

async function getFilePaths(nursingHomeId: string, month: string, year: string) {
    const supabase = createClientComponentClient()

    const { data, error } = await supabase
        .from('nursing_home_files')
        .select('file_type, file_path')
        .eq('nursing_home_id', nursingHomeId)
        .eq('month', month)
        .eq('year', year)

    if (error || !data) {
        console.error("Error fetching file paths", error)
        return { patientsPath: null, nonCcmPath: null }
    }

    const patientsPath = data.find(d => d.file_type === 'Patients')?.file_path || null
    const nonCcmPath = data.find(d => d.file_type === 'Non CCM')?.file_path || null

    return { patientsPath, nonCcmPath }
}

async function fetchAndParseExcel(path: string | null): Promise<XLSX.WorkSheet | null> {
    if (!path) return null
    const supabase = createClientComponentClient()

    const { data, error } = await supabase.storage.from('nursing-home-files').download(path)
    if (error || !data) {
        console.error("Error downloading file", error)
        return null
    }

    const arrayBuffer = await data.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    return workbook.Sheets[workbook.SheetNames[0]]
}



export function ReportGenerator({ nursingHomes }: ReportGeneratorProps) {
    const [selectedNursingHomeId, setSelectedNursingHomeId] = useState<string>("")
    const [selectedNursingHomeName, setSelectedNursingHomeName] = useState<string | null>(null)

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString("default", { month: "long" }))
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
    const [isGenerating, setIsGenerating] = useState(false)
    const [reportGenerated, setReportGenerated] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
    const [caseStudies, setCaseStudies] = useState<CaseStudyHighlight[]>([])
    const [isLoadingCaseStudies, setIsLoadingCaseStudies] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)
    const readmissionsChartRef = useRef<HTMLDivElement>(null)
    const touchpointsChartRef = useRef<HTMLDivElement>(null)
    const clinicalRisksChartRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    //let [categorizedInterventions, setCategorizedInterventions] = useState<Record<string, string[]>>({})
    const [facilityReadmissionData, setFacilityReadmissionData] = useState<any>()

    // Add intervention counts state for the Touchpoints chart
    const [interventionCounts, setInterventionCounts] = useState<Array<{ name: string; count: number }>>([
    ])

    // Add clinical risks state for the Top Clinical Risks chart
    const [clinicalRisks, setClinicalRisks] = useState<Array<{ risk: string; count: number }>>([
    ])

    // Add patient metrics state
    const [patientMetrics, setPatientMetrics] = useState({
        totalCCMPatients: 0,
        totalNonCCMPatients: 0,
        commulative30DayReadmissionCount_fromSNFAdmitDate: 0,
        commulative30DayReadmissionCount_fromSNFDischargeDate: 0,
        commulative60DayReadmissionCount: 0,
        commulative90DayReadmissionCount: 0,
        nonCCMReadmissionCount: 0,
        ccm30Day_ReadmissionRate_SNFAdmitDate: 0,
        ccm30Day_ReadmissionRate_SNFDischargeDate: 0,
        ccm60Day_ReadmissionRate: 0,
        ccm90Day_ReadmissionRate: 0,
        nonccm_ReadmissionRate: 0,
    })

    // Add patient selection state
    const [selectedPatients, setSelectedPatients] = useState<string[]>([])
    const [availablePatients, setAvailablePatients] = useState<{ id: string; name: string; created_at: string }[]>([])
    const [useAISelection, setUseAISelection] = useState(false)
    const [isLoadingPatients, setIsLoadingPatients] = useState(false)
    const [isAISelecting, setIsAISelecting] = useState(false)

    // Add effect to fetch patients when nursing home changes
    useEffect(() => {
        const run = async () => {
            if (selectedNursingHomeId && selectedNursingHomeName && selectedMonth && selectedYear) {
                await fetchAvailablePatients()
            } else {
                setAvailablePatients([])
                setSelectedPatients([])
            }

            if (selectedNursingHomeId && selectedMonth && selectedYear) {
                console.log("Running getFacilitySummary for - ", selectedNursingHomeId)
                console.log("Running getFacilitySummary for - ", selectedMonth)
                console.log("Running getFacilitySummary for - ", selectedYear)

                const data = await getFacilitySummary(selectedNursingHomeId, selectedMonth, selectedYear)
                console.log("getFacilitySummary Data is - ", data)

                setFacilityReadmissionData(data)

                if (!data) return

                const totalCCMPatients = (data.ccm_master_count || 0) + (data.ccm_master_discharged_count || 0)
                const totalNonCCMPatients = data.non_ccm_master_count || 0

                const commulative30DayReadmissionCount_fromSNFAdmitDate = data.h30_admit || 0
                const commulative30DayReadmissionCount_fromSNFDischargeDate = data.h30_discharge || 0
                const commulative60DayReadmissionCount = data.h60 || 0
                const commulative90DayReadmissionCount = data.h90 || 0
                const nonCCMReadmissionCount = data.h_reported || 0

                const ccm30Day_ReadmissionRate_SNFAdmitDate = totalCCMPatients > 0
                    ? (commulative30DayReadmissionCount_fromSNFAdmitDate / totalCCMPatients) * 100
                    : 0

                const ccm30Day_ReadmissionRate_SNFDischargeDate = totalCCMPatients > 0
                    ? (commulative30DayReadmissionCount_fromSNFDischargeDate / totalCCMPatients) * 100
                    : 0

                const ccm60Day_ReadmissionRate = totalCCMPatients > 0
                    ? (commulative60DayReadmissionCount / totalCCMPatients) * 100
                    : 0

                const ccm90Day_ReadmissionRate = totalCCMPatients > 0
                    ? (commulative90DayReadmissionCount / totalCCMPatients) * 100
                    : 0

                const nonccm_ReadmissionRate = totalNonCCMPatients > 0
                    ? (nonCCMReadmissionCount / totalNonCCMPatients) * 100
                    : 0

                setPatientMetrics({
                    totalCCMPatients,
                    totalNonCCMPatients,
                    commulative30DayReadmissionCount_fromSNFAdmitDate,
                    commulative30DayReadmissionCount_fromSNFDischargeDate,
                    commulative60DayReadmissionCount,
                    commulative90DayReadmissionCount,
                    nonCCMReadmissionCount,
                    ccm30Day_ReadmissionRate_SNFAdmitDate,
                    ccm30Day_ReadmissionRate_SNFDischargeDate,
                    ccm60Day_ReadmissionRate,
                    ccm90Day_ReadmissionRate,
                    nonccm_ReadmissionRate,
                })
            }
        }

        run()
    }, [selectedNursingHomeId, selectedNursingHomeName, selectedMonth, selectedYear])

    const fetchAvailablePatients = async () => {
        if (!selectedNursingHomeId) return

        setIsLoadingPatients(true)
        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
            const nextYear = monthNumber === 12 ? Number(selectedYear) + 1 : Number(selectedYear)
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

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
        console.log("selectedNursingHomeId is ", selectedNursingHomeId)


        setIsLoadingCaseStudies(true)

        try {
            const supabase = createClientComponentClient()

            // Get the month number (1-12) from the month name
            const monthNumber = months.indexOf(selectedMonth) + 1

            // Create date range for the selected month
            const startDate = `${selectedYear}-${monthNumber.toString().padStart(2, "0")}-01`
            const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
            const nextYear = monthNumber === 12 ? Number(selectedYear) + 1 : Number(selectedYear)
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

            // Use selected patients or all patients if none selected
            const patientIds = selectedPatients.length > 0 ? selectedPatients : availablePatients.map((p) => p.id)

            if (patientIds.length === 0) {
                setCaseStudies([])
                setIsLoadingCaseStudies(false)
                return
            }

            const { data: existingHighlights } = await supabase
                .from("patient_case_study_highlights")
                .select("patient_id")
                .in("patient_id", patientIds);

            const existingIds = new Set(existingHighlights?.map(h => h.patient_id) || []);
            const idsToGenerate = patientIds.filter(id => !existingIds.has(id));
            let buildRiskAndInterventionCategories = false

            console.log("Need to generate for ", idsToGenerate)
            await processPatientsWithLimit(idsToGenerate, 20);

            if (idsToGenerate && idsToGenerate.length > 0) {
                buildRiskAndInterventionCategories = true
            }


            // Get case studies for selected patients in the date range
            const { data, error } = await supabase
                .from("patient_case_study_highlights")
                .select(`
                    id,
                    patient_id,
                    hospital_discharge_summary_text,
                    highlight_text,
                    facility_summary_text,
                    engagement_summary_text,
                    facility_summary_quotes,
                    engagement_summary_quotes,
                    interventions,
                    outcomes,
                    clinical_risks,
                    highlight_quotes,
                    hospital_discharge_summary_quotes,
                    detailed_interventions,
                    detailed_outcomes,
                    detailed_clinical_risks,
                    created_at,
                    categorizedRisks,
                    categorizedInterventions
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
                    hospital_discharge_summary_text: cs.hospital_discharge_summary_text,
                    highlight_text: cs.highlight_text,
                    facility_summary_text: cs.facility_summary_text,
                    engagement_summary_text: cs.engagement_summary_text,
                    facility_summary_quotes: cs.facility_summary_quotes,
                    engagement_summary_quotes: cs.engagement_summary_quotes,
                    interventions: cs.interventions,
                    outcomes: cs.outcomes,
                    clinical_risks: cs.clinical_risks,
                    highlight_quotes: cs.highlight_quotes,
                    hospital_discharge_summary_quotes: cs.hospital_discharge_summary_quotes,
                    detailed_interventions: cs.detailed_interventions,
                    detailed_outcomes: cs.detailed_outcomes,
                    detailed_clinical_risks: cs.detailed_clinical_risks,
                    created_at: cs.created_at,
                    patient_name: patient?.name || "Unknown Patient",
                    categorizedInterventions: cs.categorizedInterventions,
                    categorizedRisks: cs.categorizedRisks
                }
            })

            setCaseStudies(formattedCaseStudies)

            console.log(`selectedNursingHomeId is `, selectedNursingHomeId)

            const facilityMappedName = facilityNameMap[selectedNursingHomeName!] || {
                originalName: selectedNursingHomeName,
                mappedName: selectedNursingHomeName
            }

            console.log("facilityMappedName ios ", facilityMappedName)

            console.log("buildRiskAndInterventionCategories is - ", buildRiskAndInterventionCategories)

            // Moving this to one
            if (buildRiskAndInterventionCategories) {
                console.log("buildRiskAndInterventionCategories is - ", buildRiskAndInterventionCategories)

                // Now categorize interventions
                const allInterventions = [
                    ...new Set(
                        formattedCaseStudies
                            .flatMap((cs) => cs.detailed_interventions || [])
                            .filter(Boolean)
                    ),
                ]
                console.log("BEfore categorization - allInterventions - ", allInterventions)

                if (allInterventions.length > 0) {
                    const parsedInterventions = allInterventions.map((item) =>
                        typeof item === 'string' ? JSON.parse(item) : item
                    )
                    console.log("BEfore categorization - Parsed Interventions - ", parsedInterventions)

                    const categorized = await categorizeInterventionsWithOpenAI(parsedInterventions)
                    console.log("After categorization - Catogorized Interventions - ", categorized)

                    if (categorized && typeof categorized === "object") {
                        const counts = Object.entries(categorized)
                            .map(([name, count]) => ({
                                name,
                                count: Number(count) || 0,
                            }))
                            .filter(item => item.count > 0) // ⬅️ filter out 0s
                            .sort((a, b) => b.count - a.count); // optional sorting
                        console.log("After Intervention categorization - Counts - ", counts)

                        setInterventionCounts(counts);

                        const formattedCaseStudies = data.map(async (cs) => {
                            // Update the categorized data into DB
                            const { error: updateError } = await supabase
                                .from("patient_case_study_highlights")
                                .update({
                                    categorizedInterventions: counts
                                })
                                .eq("patient_id", cs.patient_id)
                        });
                    } else {
                        console.warn("❗ Unexpected categorization response:", categorized);
                    }
                }

                const uniqueRisks = [
                    ...new Set(
                        formattedCaseStudies
                            .flatMap(study => study.clinical_risks || [])
                            .map((item) => {
                                try {
                                    const parsed = typeof item === "string" ? JSON.parse(item) : item
                                    return parsed.risk?.trim()
                                } catch {
                                    return null
                                }
                            })
                            .filter(Boolean)
                    )
                ];
                console.log("BEfore categorization - uniqueRisks - ", uniqueRisks)

                const categorizedRisks = await categorizeClinicalRisksWithOpenAI(uniqueRisks)
                console.log("After categorization - Catogorized Risks - ", categorizedRisks)

                if (categorizedRisks && typeof categorizedRisks === "object") {
                    const counts = Object.entries(categorizedRisks)
                        .map(([risk, count]) => ({
                            risk,
                            count: Number(count) || 0,
                        }))
                        .filter(item => item.count > 0) // ⬅️ filter out 0s
                        .sort((a, b) => b.count - a.count); // optional sorting
                    console.log("After RISK categorization - Counts - ", counts)

                    setClinicalRisks(counts);

                    const formattedCaseStudies = data.map(async (cs) => {
                        // Update the categorized data into DB
                        const { error: updateError } = await supabase
                            .from("patient_case_study_highlights")
                            .update({
                                categorizedRisks: counts
                            })
                            .eq("patient_id", cs.patient_id)
                    });

                } else {
                    console.warn("❗ Unexpected categorization response:", categorizedRisks);
                }
            } else {
                const formattedCaseStudies = data.map(async (cs) => {
                    setClinicalRisks(cs.categorizedRisks);
                    setInterventionCounts(cs.categorizedInterventions);
                });
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

            setIsPrinting(true)

            // Use the exportToPDF function to generate a PDF blob
            const result = await exportToPDF({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies,
                logoPath: "/puzzle_background.png",
                //categorizedInterventions,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                returnBlob: true,
            })

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
        } finally {
            setIsPrinting(false)
        }
    }, [
        nursingHomes,
        selectedNursingHomeId,
        selectedMonth,
        selectedYear,
        caseStudies,
        //categorizedInterventions,
        interventionCounts,
        clinicalRisks,
        patientMetrics,
        toast,
    ])

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
                logoPath: "/puzzle_background.png",
                //categorizedInterventions,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
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
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                returnBlob: false,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current
            })

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

    async function categorizeClinicalRisksWithOpenAI(risks: string[]) {
        const prompt = `
Below is a list of clinical risks observed in nursing home patients. 
Your task is to classify them into a small number (5 to 7) of clear, medically meaningful categories (e.g. Fall Risk, Chronic Condition Complications, Readmission Risk, etc.). 
Return the result as a JSON object with category names as keys and counts as values."

Here is the Sample response: 
{
  "Fall Risk (e.g., fractures)": 10,
  "Chronic Condition Complications": 7,
  "Readmission Risk": 5,
  "Congestive Heart Failure: 8,
  "Chronic Kidney Disease": 67,
  "Cognitive Impairment": 13
}

DO NOT return anything else.

Clinical Risks:
${JSON.stringify(risks, null, 2)}
`;

        const response = await fetch("/api/openai-categorize", {
            method: "POST",
            body: JSON.stringify({ prompt }),
            headers: { "Content-Type": "application/json" },
        });

        const json = await response.json();
        return json;
    }


    async function categorizeInterventionsWithOpenAI(interventions: string[]) {
        // Parse stringified JSON items into objects
        const parsed = interventions.map((item) =>
            typeof item === "string" ? JSON.parse(item) : item
        )

        console.log("parsed interventions are ", parsed)

        const prompt = `
You are a healthcare analyst. Your job is to classify a list of healthcare intervention descriptions into a small number of standardized categories.
Use only the following categories unless absolutely necessary:
- Care Coordination
- Medication Management
- Therapy & Rehabilitation
- Transitional Support
- Patient Engagement & Education
- Clinical Risk Management
- Behavioral & Psychosocial Support
- Nutrition & Functional Recovery

Group similar interventions under the most relevant high-level category. Avoid creating new categories unless none of the above fit.
Return the result as a JSON object with category names as keys and counts as values."
{
  "Medication reconciliations": 16,
  "Transitional Support": 10,
  "Clinical Risk Management": 2,
  "Engagement & Education": 5,
  "Care Navigation": 6,
  "Rehabilitation & Mobility Support": 20,
  "Behavioral & Psychosocial Support": 23,
  "Nutrition & Functional Recovery": 12
  ...
  ...
}
Do NOT include quotes or file IDs.

Here is the list:
${JSON.stringify(parsed, null, 2)}
`;

        const response = await fetch("/api/openai-categorize", {
            method: "POST",
            body: JSON.stringify({ prompt }),
            headers: { "Content-Type": "application/json" },
        });
        const json = await response.json();


        console.log("🧠 Sub-categorization response JSON:", json);
        return json;
    }

    const getPatientInitials = (name: string): string => {
        const nameParts = name.split(" ")
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join("")
        return initials
    }

    // Prepare data for the readmissions pie chart
    const readmissionChartData = [
        { name: "Successful Transitions", value: patientMetrics.totalCCMPatients - (patientMetrics.commulative30DayReadmissionCount_fromSNFDischargeDate) },
        { name: "30-Day Readmissions (SNF Admit)", value: 5 },
    ]

    // Calculate total interventions for the touchpoints section
    const totalInterventions = interventionCounts.reduce((sum, item) => sum + item.count, 0)

    const COLORS = ["#4ade80", "#f87171"] // Green for success, red for readmissions
    const INTERVENTION_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24"] // Blue, green, purple, yellow
    const RISK_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16"] // Red, orange, yellow, green

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

                            <Select
                                onValueChange={(value) => {
                                    setSelectedNursingHomeId(value);
                                    const selected = nursingHomes.find((home) => home.id === value);
                                    setSelectedNursingHomeName(selected?.name ?? null);
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a nursing home" />
                                </SelectTrigger>
                                <SelectContent>
                                    {nursingHomes.length === 0 ? (
                                        <div className="p-2 text-center text-sm text-muted-foreground">
                                            No nursing homes found
                                        </div>
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
                                        Choose specific patients for this report or use AI to auto-select relevant patients.
                                    </p>
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
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isGenerating || isPrinting}>
                                <PrinterIcon className={`h-4 w-4 mr-2`} />
                                {isPrinting ? "Preparing..." : "Print"}
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
                                <div className="space-y-6" >
                                    {/* Patient Snapshot Overview with Pie Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                            Patient Snapshot Overview: 30-Day Readmissions
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={readmissionsChartRef}>
                                            {/* Pie Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        successful: {
                                                            label: "Successful Transitions",
                                                            color: "#4ade80",
                                                        },
                                                        readmissions: {
                                                            label: "30-Day Readmissions",
                                                            color: "#f87171",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={readmissionChartData}
                                                                cx="50%"
                                                                cy="50%"
                                                                labelLine={false}
                                                                outerRadius={100}
                                                                fill="#8884d8"
                                                                dataKey="value"
                                                                nameKey="name"
                                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                                            >
                                                                {readmissionChartData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip content={<ChartTooltipContent />} />
                                                            <Legend />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Metrics Table */}
                                            <div className="flex flex-col justify-center">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Metric
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Count
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Percentage
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                Total Puzzle Continuity Care Patients Tracked (Active and Previously Discharged)
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.totalCCMPatients}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">-</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">30-Day Readmissions (From SNF Admit Date)</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.commulative30DayReadmissionCount_fromSNFAdmitDate}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.ccm30Day_ReadmissionRate_SNFAdmitDate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">30-Day Readmissions (From SNF Discharge Date)</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.commulative30DayReadmissionCount_fromSNFDischargeDate}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.ccm30Day_ReadmissionRate_SNFDischargeDate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">60-Day Readmissions</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.commulative60DayReadmissionCount}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.ccm60Day_ReadmissionRate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">90-Day Readmissions</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.commulative90DayReadmissionCount}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.ccm90Day_ReadmissionRate.toFixed(1)}%
                                                            </td>
                                                        </tr>

                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">Non CCM Readmissions</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.nonCCMReadmissionCount}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.nonccm_ReadmissionRate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Puzzle's Touchpoints with Bar Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">Puzzle's Touchpoints</h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={touchpointsChartRef}>
                                            {/* Bar Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        interventions: {
                                                            label: "Interventions",
                                                            color: "#60a5fa",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={interventionCounts}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="Count">
                                                                {interventionCounts.map((entry, index) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={INTERVENTION_COLORS[index % INTERVENTION_COLORS.length]}
                                                                    />
                                                                ))}
                                                                <LabelList dataKey="count" position="right" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Summary */}
                                            <div className="flex flex-col justify-center">
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <div className="text-lg font-semibold mb-3">
                                                        Total Interventions Delivered: {totalInterventions}
                                                    </div>
                                                    <ul className="text-sm space-y-2">
                                                        {interventionCounts.map((item, index) => (
                                                            <li key={index} className="flex items-center">
                                                                <span
                                                                    className="w-3 h-3 rounded-full mr-2"
                                                                    style={{ backgroundColor: INTERVENTION_COLORS[index % INTERVENTION_COLORS.length] }}
                                                                ></span>
                                                                {item.count} {item.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Clinical Risks with Horizontal Bar Chart */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                            Top Clinical Risks Identified at Discharge
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" ref={clinicalRisksChartRef}>
                                            {/* Horizontal Bar Chart */}
                                            <div className="h-[300px]" >
                                                <ChartContainer
                                                    config={{
                                                        patients: {
                                                            label: "Count across Patients",
                                                            color: "#ef4444",
                                                        },
                                                    }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={clinicalRisks}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="risk" type="category" width={180} tick={{ fontSize: 12 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="Count across Patients">
                                                                {clinicalRisks.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="count" position="right" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>

                                            {/* Table */}
                                            <div className="flex flex-col justify-center">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 tracking-wider">
                                                                Clinical Risk
                                                            </th>
                                                            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 tracking-wider">
                                                                Count across Patients
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {clinicalRisks.map((risk, index) => (
                                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                <td className="px-4 py-3 text-sm text-gray-900 flex items-center">
                                                                    <span
                                                                        className="w-3 h-3 rounded-full mr-2"
                                                                        style={{ backgroundColor: RISK_COLORS[index % RISK_COLORS.length] }}
                                                                    ></span>
                                                                    {risk.risk}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">{risk.count}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg p-6 bg-white">
                                        <h3 className="text-xl font-semibold text-blue-800 mb-4">
                                            Puzzle's Key Interventions and Outcomes for Patients
                                        </h3>

                                        {caseStudies.map((study) => {
                                            const [first, last] = (study.patient_name || "").split(" ");
                                            const shortName =
                                                first && last ? `${first[0]}.${last}` : study.patient_name || "Unknown";

                                            return (
                                                <div key={study.id} className="mb-6">
                                                    <p className="text-sm font-semibold text-gray-800 mb-2">{shortName}</p>

                                                    {/* Interventions */}
                                                    {(study.detailed_interventions || []).length > 0 && (
                                                        <>
                                                            <p className="text-sm font-medium text-gray-700 mb-1">Interventions:</p>
                                                            <ul className="list-disc list-inside pl-4 text-sm text-gray-700 space-y-1 mb-3">
                                                                {study.detailed_interventions.map((item, idx) => (
                                                                    <li key={`int-${idx}`}>
                                                                        {item.intervention}
                                                                        {item.source_quote && (
                                                                            <p className="text-xs text-gray-500 italic mt-1 pl-2">
                                                                                “{item.source_quote}”
                                                                                {item.source_file_id && (
                                                                                    <>
                                                                                        {" — "}
                                                                                        <a
                                                                                            href={`/api/download-file?id=${item.source_file_id}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 underline"
                                                                                        >
                                                                                            Download Source
                                                                                        </a>
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}

                                                    {/* Outcomes */}
                                                    {(study.detailed_outcomes || []).length > 0 && (
                                                        <>
                                                            <p className="text-sm font-medium text-gray-700 mb-1">Outcomes:</p>
                                                            <ul className="list-disc list-inside pl-4 text-sm text-gray-700 space-y-1">
                                                                {study.detailed_outcomes.map((item, idx) => (
                                                                    <li key={`out-${idx}`}>
                                                                        {item.outcome}
                                                                        {item.source_quote && (
                                                                            <p className="text-xs text-gray-500 italic mt-1 pl-2">
                                                                                “{item.source_quote}”
                                                                                {item.source_file_id && (
                                                                                    <>
                                                                                        {" — "}
                                                                                        <a
                                                                                            href={`/api/download-file?id=${item.source_file_id}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 underline"
                                                                                        >
                                                                                            Download Source
                                                                                        </a>
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Case Studies */}
                                    {console.log("📘 Case Studies:", caseStudies)}

                                    <div className="border rounded-lg p-6 bg-white">
                                        <h3 className="text-xl font-semibold text-blue-800 mb-4">Case Study Highlights</h3>
                                        {caseStudies.length > 0 ? (
                                            caseStudies.map((study) => (

                                                <div key={study.id} className="border-l-4 border-blue-500 pl-4 py-2 mb-4">
                                                    <p className="text-sm font-medium">
                                                        {(() => {
                                                            const [first, last] = study.patient_name.split(" ");
                                                            return `${first[0]}.${last}`;
                                                        })()}
                                                    </p>
                                                    <p className="text-sm font-medium">
                                                        {study.hospital_discharge_summary_text
                                                            ? study.hospital_discharge_summary_text.charAt(0).toUpperCase() + study.hospital_discharge_summary_text.slice(1)
                                                            : ''}
                                                    </p>

                                                    <Citations label="Cited from" quotes={study.hospital_discharge_summary_quotes || []} />

                                                    <p className="text-sm mt-4">
                                                        {study.facility_summary_text
                                                            ? study.facility_summary_text.charAt(0).toUpperCase() + study.facility_summary_text.slice(1)
                                                            : ''}
                                                    </p>
                                                    <Citations label="Cited from" quotes={study.facility_summary_quotes || []} />

                                                    <p className="text-sm mt-4">
                                                        {study.engagement_summary_text
                                                            ? study.engagement_summary_text.charAt(0).toUpperCase() + study.engagement_summary_text.slice(1)
                                                            : ''}
                                                    </p>
                                                    <Citations label="Cited from" quotes={study.engagement_summary_quotes || []} />

                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                No case studies found for the selected criteria.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}