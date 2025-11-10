"use client"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils" // helper for conditional classes

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FileDownIcon, FileIcon, FileTextIcon, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
async function getFacilityStatic(nursingHomeId: string) {
    const supabase = createClientComponentClient()

    console.log("Running getFacilityStatic for - ", nursingHomeId)


    const { data, error } = await supabase
        .from('nursing_homes')
        .select('*')
        .eq('id', nursingHomeId)
        .single() // returns one row instead of array        

    console.log("getFacilityStatic Data is - ", data)

    if (error) {
        console.error("❌ Failed to fetch facility summary:", error)
        return null
    }

    return data
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
        .maybeSingle(); // safe: returns null if no row

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
        return { patientsPath: null, nonCcmPath: null, bambooReportPath: null }
    }

    const patientsPath = data.find(d => d.file_type === 'Patients')?.file_path || null
    const nonCcmPath = data.find(d => d.file_type === 'Non CCM')?.file_path || null
    const bambooReportPath = data.find(d => d.file_type === 'Bamboo Report')?.file_path || null

    return { patientsPath, nonCcmPath, bambooReportPath }
}

async function getBambooReportPath(month: string, year: string, state: string) {
    const supabase = createClientComponentClient()
    const PUZZLE_FACILITY_ID = "1688ba99-e4d3-4543-a0ba-7caa37e33a1c"

    const { data, error } = await supabase
        .from('nursing_home_files')
        .select('file_type, file_path, us_state')
        .eq('nursing_home_id', PUZZLE_FACILITY_ID)
        .eq('month', month)
        .eq('year', year)
        .eq('us_state', state)
        .eq('file_type', 'Bamboo Report')


    if (error || !data) {
        console.error("Error fetching Bamboo Report file path", error)
        return null
    }

    return data[0]?.file_path || null
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

async function parseReadmittedPatientsFromExcel(
    filePath: string | null,
    facilityName: string
): Promise<Array<{
    name: string;
    hospitalDischargeDate: string;
    snfDischargeDate: string;
    hospitalReadmitDate: string;
    hospitalName: string;
    readmissionReason: string;
}>> {
    if (!filePath) return []

    const supabase = createClientComponentClient()
    const { data, error } = await supabase.storage.from('nursing-home-files').download(filePath)

    if (error || !data) {
        console.error("Error downloading file for readmitted patients", error)
        return []
    }

    const arrayBuffer = await data.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    const readmittedPatients: Array<{
        name: string;
        hospitalDischargeDate: string;
        snfDischargeDate: string;
        hospitalReadmitDate: string;
        hospitalName: string;
        readmissionReason: string;
    }> = []

    // Check all three sheets: CCM Master, CCM Master Discharged, and PMR - Non CCM
    const sheetConfigs = [
        { name: 'CCM Master', readmissionField: '30 Day Reported Hospitalization - from SNF Admit Date' },
        { name: 'CCM Master Discharged', readmissionField: '30 Day Reported Hospitalization - from SNF Admit Date' },
        { name: 'PMR - Non CCM', readmissionField: 'SNF Admit Date' }
    ]

    const formatDate = (dateValue: any): string => {
        if (!dateValue) return 'N/A'
        try {
            // Handle Excel date numbers
            if (typeof dateValue === 'number') {
                const excelEpoch = new Date(1899, 11, 30)
                const date = new Date(excelEpoch.getTime() + dateValue * 86400000)
                return date.toLocaleDateString()
            }
            // Handle date strings
            const date = new Date(dateValue)
            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
        } catch {
            return 'N/A'
        }
    }

    const parseDateRange = (dateRangeStr: any): { readmitDate: string; reDischargeDate: string } => {
        // Parse format like "04/18/2025 - 04/25/2025" where first date is readmit, second is re-discharge
        if (!dateRangeStr) return { readmitDate: 'N/A', reDischargeDate: 'N/A' }

        const str = dateRangeStr.toString().trim()
        const parts = str.split('-').map((p: string) => p.trim())

        if (parts.length === 2) {
            return {
                readmitDate: parts[0] || 'N/A',
                reDischargeDate: parts[1] || 'N/A'
            }
        }

        // If not in range format, might be a single date
        return { readmitDate: str, reDischargeDate: 'N/A' }
    }

    for (const config of sheetConfigs) {
        const sheet = workbook.Sheets[config.name]
        if (!sheet) {
            console.log(`Sheet "${config.name}" not found in workbook`)
            continue
        }

        const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
        console.log(`Processing sheet "${config.name}" with ${data.length} rows`)

        for (const row of data) {
            const snfFacility = row['SNF Facility Name']?.toString().trim()
            const patientName = row['Patient Name']?.toString().trim()

            // Different logic based on sheet type
            let hasReadmission = false
            let parsedReadmitDate = 'N/A'

            if (config.name === 'PMR - Non CCM') {
                // For PMR - Non CCM, check if SNF Admit Date has data
                hasReadmission = !!row['SNF Admit Date']
                console.log(`PMR - Non CCM: Patient ${patientName}, SNF Admit Date: ${row['SNF Admit Date']}, hasReadmission: ${hasReadmission}, facility name: ${snfFacility} vs target: ${facilityName}`)
            } else {
                // For CCM Master and CCM Master Discharged, check the readmission field
                const readmissionField = row[config.readmissionField]
                if (readmissionField) {
                    hasReadmission = true
                    // Parse the date range format "04/18/2025 - 04/25/2025"
                    const dateRange = parseDateRange(readmissionField)
                    parsedReadmitDate = dateRange.readmitDate  // Hospital readmit date (first date in range)
                    console.log(`${config.name}: Patient ${patientName}, Readmission field: ${readmissionField}, Parsed readmit date: ${parsedReadmitDate}, facility name: ${snfFacility} vs target: ${facilityName}`)
                }
            }

            // Only process if there's a readmission for this facility
            if (!snfFacility || snfFacility.toLowerCase() !== facilityName.toLowerCase() || !hasReadmission || !patientName) {
                continue
            }

            // Extract all required fields
            const hospitalDischargeDate = row['Hospital Discharge Date']
            const snfDischargeDate = row['SNF Discharge Date']
            const hospitalReadmitDate = row['Hospital Readmit Date'] || parsedReadmitDate
            const hospitalName = row['Hospital Name']?.toString().trim() || 'N/A'
            const readmissionReason = row['Readmission Reason']?.toString().trim() || 'N/A'

            readmittedPatients.push({
                name: patientName,
                hospitalDischargeDate: formatDate(hospitalDischargeDate),
                snfDischargeDate: formatDate(snfDischargeDate),
                hospitalReadmitDate: typeof hospitalReadmitDate === 'string' ? hospitalReadmitDate : formatDate(hospitalReadmitDate),
                hospitalName: hospitalName,
                readmissionReason: readmissionReason
            })
        }
    }

    console.log(`Found ${readmittedPatients.length} readmitted patients for facility "${facilityName}"`)
    console.log(readmittedPatients)
    return readmittedPatients
}



export function ReportGenerator({ nursingHomes }: ReportGeneratorProps) {
    const [selectedNursingHomeId, setSelectedNursingHomeId] = useState<string>("")
    const [selectedNursingHomeName, setSelectedNursingHomeName] = useState<string | null>(null)
    const [selectedState, setSelectedState] = useState<string>("")

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
    let [categorizedInterventions, setCategorizedInterventions] = useState<Record<string, string[]>>({})
    const [facilityReadmissionData, setFacilityReadmissionData] = useState<any>()
    const [facilityData, setFacilityData] = useState<any>()
    const [open, setOpen] = useState(false)

    // Add intervention counts state for the Touchpoints chart
    const [interventionCounts, setInterventionCounts] = useState<Array<{ name: string; count: number }>>([
    ])

    // Add clinical risks state for the Top Clinical Risks chart
    const [clinicalRisks, setClinicalRisks] = useState<Array<{ risk: string; count: number }>>([
    ])

    // Add readmitted patients state
    const [readmittedPatients, setReadmittedPatients] = useState<Array<{
        name: string;
        hospitalDischargeDate: string;
        snfDischargeDate: string;
        hospitalReadmitDate: string;
        hospitalName: string;
        readmissionReason: string;
    }>>([
    ])

    // Add patient metrics state
    const [patientMetrics, setPatientMetrics] = useState({
        totalPuzzlePatients: 0,
        commulative30DayReadmissionCount_fromSNFAdmitDate: 0,
        commulative30Day_ReadmissionRate: 0,
        facilityName: " ",
        executiveSummary: " ",
        closingStatement: " ",
        publicLogoLink: " ",
        nationalReadmissionsBenchmark: 0
    })

    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null)

    // Track per-section patient selections
    const [selectedCaseStudyPatients, setSelectedCaseStudyPatients] = useState<string[]>([])
    const [selectedInterventionPatients, setSelectedInterventionPatients] = useState<string[]>([])
    const [availablePatients, setAvailablePatients] = useState<{ id: string; name: string; created_at: string }[]>([])
    const [useAISelection, setUseAISelection] = useState(false)
    const [isLoadingPatients, setIsLoadingPatients] = useState(false)
    const [isAISelecting, setIsAISelecting] = useState(false)
    const [showPatientPHI, setShowPatientPHI] = useState(true)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingStudyId, setEditingStudyId] = useState<string | null>(null)
    const [editedStudy, setEditedStudy] = useState<CaseStudyHighlight | null>(null)
    const [isSavingStudy, setIsSavingStudy] = useState(false)

    const selectedPatientIds = useMemo(
        () => Array.from(new Set([...selectedCaseStudyPatients, ...selectedInterventionPatients])),
        [selectedCaseStudyPatients, selectedInterventionPatients]
    )

    const caseStudyEntries = useMemo(() => {
        if (selectedCaseStudyPatients.length === 0) return []
        return caseStudies.filter((study) => selectedCaseStudyPatients.includes(study.patient_id))
    }, [caseStudies, selectedCaseStudyPatients])

    const interventionEntries = useMemo(() => {
        if (selectedInterventionPatients.length === 0) return []
        return caseStudies.filter((study) => selectedInterventionPatients.includes(study.patient_id))
    }, [caseStudies, selectedInterventionPatients])

    const formatPatientName = useCallback(
        (rawName?: string) => {
            const name = (rawName || "").trim()
            if (!name) return "Unknown"

            const parts = name.split(/\s+/)
            const first = parts[0] || ""
            const last = parts.slice(1).join(" ")

            if (showPatientPHI) {
                if (first && last) {
                    return `${first.charAt(0).toUpperCase()}. ${last}`
                }
                return name
            }

            const firstInitial = first ? `${first.charAt(0).toUpperCase()}.` : ""
            const lastInitial = last ? last.charAt(0).toUpperCase() : ""
            const masked = [firstInitial, lastInitial].filter(Boolean).join(" ")

            return masked || "Unknown"
        },
        [showPatientPHI]
    )

    const applyPatientPrivacy = useCallback(
        (entries: CaseStudyHighlight[]) =>
            entries.map((study) => ({
                ...study,
                patient_name: formatPatientName(study.patient_name),
            })),
        [formatPatientName]
    )

    const normalizeDetailedEntries = useCallback(
        (entries: any[] | undefined, key: "intervention" | "outcome") => {
            if (!Array.isArray(entries)) return []
            return entries.map((item) => {
                if (!item) {
                    return { [key]: "" }
                }
                if (typeof item === "string") {
                    try {
                        const parsed = JSON.parse(item)
                        if (parsed && typeof parsed === "object") {
                            return parsed
                        }
                        return { [key]: parsed ?? "" }
                    } catch {
                        return { [key]: item }
                    }
                }
                return item
            })
        },
        []
    )

    const handleOpenEditDialog = useCallback(
        (study: CaseStudyHighlight) => {
            const cloned = JSON.parse(JSON.stringify(study)) as CaseStudyHighlight
            cloned.detailed_interventions = normalizeDetailedEntries(cloned.detailed_interventions, "intervention")
            cloned.detailed_outcomes = normalizeDetailedEntries(cloned.detailed_outcomes, "outcome")
            setEditingStudyId(study.id)
            setEditedStudy(cloned)
            setIsEditDialogOpen(true)
        },
        [normalizeDetailedEntries]
    )

    const handleCloseEditDialog = useCallback(() => {
        setIsEditDialogOpen(false)
        setEditingStudyId(null)
        setEditedStudy(null)
        setIsSavingStudy(false)
    }, [])

    const handleEditedFieldChange = useCallback((field: keyof CaseStudyHighlight, value: string) => {
        setEditedStudy((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                [field]: value,
            }
        })
    }, [])

    const handleDetailedEntryChange = useCallback(
        (field: "detailed_interventions" | "detailed_outcomes", index: number, key: "intervention" | "outcome", value: string) => {
            setEditedStudy((prev) => {
                if (!prev) return prev
                const existingEntries = Array.isArray(prev[field]) ? [...(prev[field] as any[])] : []
                const entry = { ...(existingEntries[index] || {}) }
                entry[key] = value
                existingEntries[index] = entry
                return {
                    ...prev,
                    [field]: existingEntries,
                } as CaseStudyHighlight
            })
        },
        []
    )

    const handleSaveEditedStudy = useCallback(async () => {
        if (!editedStudy || !editingStudyId) return
        try {
            setIsSavingStudy(true)
            const supabase = createClientComponentClient()

            const sanitizeText = (value?: string | null) => (value ? value.trim() : "")

            const cleanedInterventions = (Array.isArray(editedStudy.detailed_interventions) ? editedStudy.detailed_interventions : []).map(
                (item: any) => ({
                    ...item,
                    intervention: sanitizeText(item?.intervention),
                })
            )

            const cleanedOutcomes = (Array.isArray(editedStudy.detailed_outcomes) ? editedStudy.detailed_outcomes : []).map(
                (item: any) => ({
                    ...item,
                    outcome: sanitizeText(item?.outcome),
                })
            )

            const payload: Record<string, any> = {
                highlight_text: sanitizeText(editedStudy.highlight_text),
                hospital_discharge_summary_text: sanitizeText(editedStudy.hospital_discharge_summary_text),
                facility_summary_text: sanitizeText(editedStudy.facility_summary_text),
                engagement_summary_text: sanitizeText(editedStudy.engagement_summary_text),
                detailed_interventions: cleanedInterventions,
                detailed_outcomes: cleanedOutcomes,
            }

            const { error } = await supabase
                .from("patient_case_study_highlights")
                .update(payload)
                .eq("id", editingStudyId)

            if (error) {
                throw error
            }

            setCaseStudies((prev) =>
                prev.map((study) =>
                    study.id === editingStudyId
                        ? {
                              ...study,
                              ...payload,
                          }
                        : study
                )
            )

            toast({
                title: "Saved",
                description: "Updates saved successfully.",
            })
            handleCloseEditDialog()
        } catch (error) {
            console.error("Error saving study:", error)
            toast({
                title: "Error",
                description: "Failed to save changes. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsSavingStudy(false)
        }
    }, [editedStudy, editingStudyId, toast, handleCloseEditDialog])

    const phiPreviewExample = useMemo(() => formatPatientName("Casey Carrier"), [formatPatientName])

    const safeInterventionCounts = useMemo(
        () =>
            Array.isArray(interventionCounts)
                ? interventionCounts.filter(
                    (item): item is { name: string; count: number } =>
                        !!item && typeof item.name === "string" && typeof item.count === "number"
                )
                : [],
        [interventionCounts]
    )

    // Add effect to fetch patients when nursing home changes
    useEffect(() => {
        const run = async () => {
            if (selectedNursingHomeId && selectedNursingHomeName && selectedMonth && selectedYear) {
                await fetchAvailablePatients()
            } else {
                setAvailablePatients([])
                setSelectedCaseStudyPatients([])
                setSelectedInterventionPatients([])
                setSelectedNursingHomeName(null)
            }

            if (selectedNursingHomeId && selectedMonth && selectedYear) {
                console.log("Running getFacilitySummary for - ", selectedNursingHomeId)
                console.log("Running getFacilitySummary for - ", selectedMonth)
                console.log("Running getFacilitySummary for - ", selectedYear)

                const data = await getFacilitySummary(selectedNursingHomeId, selectedMonth, selectedYear)
                console.log("getFacilitySummary Data is - ", data)
                setFacilityReadmissionData(data)

                const facilityStaticInfo = await getFacilityStatic(selectedNursingHomeId)
                setFacilityData(facilityStaticInfo)

                // Fetch readmitted patients from AllPuzzleFacility Bamboo Report
                if (facilityStaticInfo && facilityStaticInfo.us_state) {
                    const bambooReportPath = await getBambooReportPath(selectedMonth, selectedYear, facilityStaticInfo.us_state)
                    console.log("Bamboo Report Path is - ", bambooReportPath)

                    if (bambooReportPath && selectedNursingHomeName) {
                        console.log(`Fetching readmitted patients from Bamboo Report: ${bambooReportPath}`)
                        const readmitted = await parseReadmittedPatientsFromExcel(bambooReportPath, selectedNursingHomeName)
                        console.log(`Setting ${readmitted.length} readmitted patients in state`)
                        setReadmittedPatients(readmitted)
                    } else {
                        console.log('No Bamboo Report found for the selected month/year/state')
                        setReadmittedPatients([])
                    }
                } else {
                    console.log('Facility state not available')
                    setReadmittedPatients([])
                }

                if (!data) return


                const totalPuzzlePatients = (data.ccm_master_count || 0) +
                    (data.ccm_master_discharged_count || 0) +
                    (data.non_ccm_master_count || 0)


                const commulative30DayReadmissionCount_fromSNFAdmitDate = data.h30_admit || 0

                const commulative30Day_ReadmissionRate = totalPuzzlePatients > 0
                    ? (commulative30DayReadmissionCount_fromSNFAdmitDate / totalPuzzlePatients) * 100
                    : 0
                const executiveSummary = `We are pleased to share this Puzzle SNF Report highlighting our collaborative work at ${facilityStaticInfo.name}. Our coordinated efforts have supported seamless transitions, identified key risks early, and driven down avoidable readmissions. This report reflects the outcomes achieved through our joint commitment to high-quality, post-acute care.`
                const closingStatement = `Together at ${facilityStaticInfo.name}, we've made important strides in reducing avoidable hospital returns and improving resident care experiences. We value this partnership deeply and look forward to building on this foundation to deliver even more impactful care.`

                setPatientMetrics({
                    totalPuzzlePatients,
                    commulative30DayReadmissionCount_fromSNFAdmitDate,
                    commulative30Day_ReadmissionRate,
                    facilityName: facilityStaticInfo.name,
                    publicLogoLink: facilityStaticInfo.logo_url,
                    executiveSummary: executiveSummary,
                    closingStatement: closingStatement,

                    nationalReadmissionsBenchmark: Number(process.env.NEXT_PUBLIC_NATIONAL_READMISSION_BENCHMARK)
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
            setSelectedCaseStudyPatients([])
            setSelectedInterventionPatients([])
            setExpandedPatientId(null)
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

    const handlePatientToggle = (patientId: string) => {
        if (selectedPatientIds.includes(patientId)) {
            setSelectedCaseStudyPatients((prev) => prev.filter((id) => id !== patientId))
            setSelectedInterventionPatients((prev) => prev.filter((id) => id !== patientId))
            if (expandedPatientId === patientId) {
                setExpandedPatientId(null)
            }
        } else {
            setSelectedCaseStudyPatients((prev) => [...prev, patientId])
            setSelectedInterventionPatients((prev) => [...prev, patientId])
        }
    }

    const handleSelectAllPatients = () => {
        const allIds = availablePatients.map((p) => p.id)
        setSelectedCaseStudyPatients(allIds)
        setSelectedInterventionPatients(allIds)
    }

    const handleDeselectAllPatients = () => {
        setSelectedCaseStudyPatients([])
        setSelectedInterventionPatients([])
        setExpandedPatientId(null)
    }

    const handleCaseStudyAssignmentToggle = (patientId: string) => {
        setSelectedCaseStudyPatients((prev) => {
            const exists = prev.includes(patientId)
            if (exists && expandedPatientId === patientId) {
                setExpandedPatientId(null)
            }
            return exists ? prev.filter((id) => id !== patientId) : [...prev, patientId]
        })
    }

    const handleInterventionAssignmentToggle = (patientId: string) => {
        setSelectedInterventionPatients((prev) =>
            prev.includes(patientId) ? prev.filter((id) => id !== patientId) : [...prev, patientId],
        )
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
            const patientIds =
                selectedPatientIds.length > 0 ? selectedPatientIds : availablePatients.map((p) => p.id)

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
                    setClinicalRisks(Array.isArray(cs.categorizedRisks) ? cs.categorizedRisks : []);
                    setInterventionCounts(Array.isArray(cs.categorizedInterventions) ? cs.categorizedInterventions : []);
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

    const handlePrint = useCallback(async (patientMetrics: any) => {
        try {

            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            setIsPrinting(true)

            console.log("categorizedInterventions are ", categorizedInterventions)

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies)
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries)
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries)
            const privacySafeReadmittedPatients = readmittedPatients.map(patient => ({
                ...patient,
                name: formatPatientName(patient.name)
            }))

            // Use the exportToPDF function to generate a PDF blob
            const result = await exportToPDF({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies: privacySafeCaseStudies,
                caseStudyHighlights: privacySafeCaseStudyEntries,
                interventionStudies: privacySafeInterventionEntries,
                patientMetrics,
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                expandedPatientId,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                returnBlob: true,
                interventionCounts: safeInterventionCounts,
                totalInterventions: totalInterventions,
                clinicalRisks: clinicalRisks,
                readmittedPatients: privacySafeReadmittedPatients
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
        caseStudyEntries,
        interventionEntries,
        categorizedInterventions,
        safeInterventionCounts,
        clinicalRisks,
        patientMetrics,
        toast,
        applyPatientPrivacy,
    ])

    const handleExportPDF = async (patientMetrics: any) => {

        try {
            setIsExporting(true)
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId)

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found')
            }

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies)
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries)
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries)
            const privacySafeReadmittedPatients = readmittedPatients.map(patient => ({
                ...patient,
                name: formatPatientName(patient.name)
            }))

            // Use the exportToPDF function from export-utils
            await exportToPDF({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies: privacySafeCaseStudies,
                caseStudyHighlights: privacySafeCaseStudyEntries,
                interventionStudies: privacySafeInterventionEntries,
                patientMetrics,
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                expandedPatientId,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                interventionCounts: safeInterventionCounts,
                totalInterventions: totalInterventions,
                clinicalRisks: clinicalRisks,
                readmittedPatients: privacySafeReadmittedPatients
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

    const handleExportDOCX = async (patientMetrics: any) => {

        try {
            setIsExporting(true);
            const selectedNursingHome = nursingHomes.find(home => home.id === selectedNursingHomeId);

            if (!selectedNursingHome) {
                throw new Error('Selected nursing home not found');
            }

            const privacySafeCaseStudies = applyPatientPrivacy(caseStudies);
            const privacySafeCaseStudyEntries = applyPatientPrivacy(caseStudyEntries);
            const privacySafeInterventionEntries = applyPatientPrivacy(interventionEntries);

            await exportToDOCX({
                nursingHomeName: selectedNursingHome.name,
                monthYear: `${selectedMonth} ${selectedYear}`,
                caseStudies: privacySafeCaseStudies,
                caseStudyHighlights: privacySafeCaseStudyEntries,
                interventionStudies: privacySafeInterventionEntries,
                patientMetrics,
                logoPath: "/puzzle_background.png",
                categorizedInterventions,
                returnBlob: false,
                expandedPatientId,
                interventionCounts: safeInterventionCounts,
                readmissionsChartRef: readmissionsChartRef.current,
                touchpointsChartRef: touchpointsChartRef.current,
                clinicalRisksChartRef: clinicalRisksChartRef.current,
                clinicalRisks:clinicalRisks
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
        {
            name: "Successful Transitions",
            value: (
                patientMetrics.totalPuzzlePatients -
                patientMetrics.commulative30DayReadmissionCount_fromSNFAdmitDate
            ),
            color: "#4ade80", // green
        },
        {
            name: "30-Day Readmissions",
            value: (
                patientMetrics.commulative30DayReadmissionCount_fromSNFAdmitDate
            ),
            color: "#facc15", // yellow
        }
    ]

    console.log("Facility Metrics ", patientMetrics)

    // Calculate total interventions for the touchpoints section
    const totalInterventions = safeInterventionCounts.reduce((sum, item) => sum + item.count, 0)

    //const COLORS = ["#4ade80", "#f87171"] // Green for success, red for readmissions
    const COLORS = [
        "#4ade80", // Successful
        "#facc15" // 30-Day
    ]

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

                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between"
                                    >
                                        {selectedNursingHomeName || "Select a nursing home"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command
                                        filter={(value, search) => {
                                            // Force strict substring match (case-insensitive)
                                            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                        }}

                                    >
                                        <CommandInput placeholder="Search nursing home..." />
                                        <CommandList>
                                            <CommandEmpty>No nursing homes found.</CommandEmpty>
                                            <CommandGroup>
                                                {[...nursingHomes]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((home) => (
                                                        <CommandItem
                                                            key={home.id}
                                                            value={home.name}
                                                            onSelect={() => {
                                                                setSelectedNursingHomeId(home.id)
                                                                setSelectedNursingHomeName(home.name)
                                                                setOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    home.id === selectedNursingHomeId
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {home.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                                            Case Studies: {selectedCaseStudyPatients.length} • Key Interventions: {selectedInterventionPatients.length}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSelectAllPatients}
                                                disabled={
                                                    selectedCaseStudyPatients.length === availablePatients.length &&
                                                    selectedInterventionPatients.length === availablePatients.length
                                                }
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleDeselectAllPatients}
                                                disabled={selectedPatientIds.length === 0}
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
                                        {availablePatients.map((patient) => {
                                            const isSelected = selectedPatientIds.includes(patient.id)
                                            const inCaseStudies = selectedCaseStudyPatients.includes(patient.id)
                                            const inInterventions = selectedInterventionPatients.includes(patient.id)

                                            return (
                                                <div
                                                    key={patient.id}
                                                    className="flex flex-col p-2 rounded border bg-white hover:bg-slate-50"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`patient-${patient.id}`}
                                                            checked={isSelected}
                                                            onChange={() => handlePatientToggle(patient.id)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <Label htmlFor={`patient-${patient.id}`} className="text-sm cursor-pointer flex-1 truncate">
                                                            {patient.name}
                                                        </Label>
                                                    </div>

                                                    {isSelected && (
                                                        <>
                                                            <div className="flex flex-wrap items-center gap-4 pl-6 pt-2 text-xs text-muted-foreground">
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`patient-${patient.id}-case`}
                                                                        checked={inCaseStudies}
                                                                        onChange={() => handleCaseStudyAssignmentToggle(patient.id)}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                    Case Studies
                                                                </label>
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`patient-${patient.id}-interventions`}
                                                                        checked={inInterventions}
                                                                        onChange={() => handleInterventionAssignmentToggle(patient.id)}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                    Key Interventions
                                                                </label>
                                                            </div>

                                                            {inCaseStudies && (
                                                                <div className="flex items-center pl-6 pt-1">
                                                                    <input
                                                                        type="radio"
                                                                        id={`expanded-${patient.id}`}
                                                                        name="expandedPatient"
                                                                        checked={expandedPatientId === patient.id}
                                                                        onChange={() => setExpandedPatientId(patient.id)}
                                                                        className="mr-2"
                                                                    />
                                                                    <Label htmlFor={`expanded-${patient.id}`} className="text-xs text-muted-foreground">
                                                                        Mark as Expanded Summary Patient
                                                                    </Label>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })}
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
                <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex w-full flex-col gap-3 md:w-auto">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="patient-phi-toggle"
                                    checked={showPatientPHI}
                                    onCheckedChange={setShowPatientPHI}
                                    aria-label="Toggle patient PHI visibility"
                                />
                                <div className="space-y-0.5">
                                    <Label htmlFor="patient-phi-toggle" className="text-sm font-medium leading-none">
                                        Patient PHI visibility
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {showPatientPHI ? "Show" : "Hide"} patient last names in this report.
                                    </p>
                                </div>
                            </div>
                        </div>
                        {caseStudies.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Found {caseStudies.length} case studies for your selections.
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleGenerateReport}
                        disabled={
                            !selectedNursingHomeId || isGenerating || (availablePatients.length > 0 && selectedPatientIds.length === 0)
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
                            {selectedPatientIds.length > 0 && selectedPatientIds.length < availablePatients.length && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Report includes {selectedPatientIds.length} selected patients
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm"
                                onClick={() => handlePrint(patientMetrics)} // <- passing explicitly
                                disabled={isGenerating || isPrinting}>
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
                                    <DropdownMenuItem
                                        onClick={() => handleExportPDF(patientMetrics)} // <- passing explicitly

                                    >
                                        <FileTextIcon className="h-4 w-4 mr-2" />
                                        Export as PDF
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
                                                            label: "30-Day Readmissions (Puzzle Patients)",
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
                                                                Total Puzzle Continuity Care Patients Tracked
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.totalPuzzlePatients}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">-</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-3 text-sm text-gray-900">30-Day Readmissions (Puzzle Patients)</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                                {patientMetrics.commulative30DayReadmissionCount_fromSNFAdmitDate}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                                {patientMetrics.commulative30Day_ReadmissionRate.toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Re-Admitted Patients Table - Separate Section */}
                                    {readmittedPatients.length > 0 && (
                                        <div className="border rounded-lg p-6 bg-white">
                                            <h2 className="text-xl font-semibold text-blue-800 mb-4">
                                                30-Day Re-Admitted Patients
                                            </h2>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Patient Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Discharge Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                SNF Discharge Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Readmission Date
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Hospital Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Readmission Reason
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {readmittedPatients.map((patient, index) => (
                                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {formatPatientName(patient.name)}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.hospitalDischargeDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.snfDischargeDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                                    {patient.hospitalReadmitDate}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                                    {patient.hospitalName}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                                    {patient.readmissionReason}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
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
                                            data={safeInterventionCounts}
                                                            layout="vertical"
                                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="Count">
                                                        {safeInterventionCounts.map((entry, index) => (
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
                                                        {safeInterventionCounts.map((item, index) => (
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

                                        {interventionEntries.length > 0 ? interventionEntries.map((study) => {
                                            const shortName = formatPatientName(study.patient_name)

                                            return (
                                                <div key={study.id} className="mb-6">
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <p className="text-sm font-semibold text-gray-800">{shortName}</p>
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(study)}>
                                                            Edit
                                                        </Button>
                                                    </div>

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
                                        }) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                {selectedInterventionPatients.length === 0
                                                    ? "No patients have been assigned to the Key Interventions section."
                                                    : "No intervention details available for the selected patients."}
                                            </div>
                                        )}
                                    </div>

                                    {/* Case Studies */}
                                    <div className="border rounded-lg p-6 bg-white">
                                        <h3 className="text-xl font-semibold text-blue-800 mb-4">Case Study Highlights</h3>
                                        {caseStudyEntries.length > 0 ? (
                                            caseStudyEntries.map((study) => {
                                                const shortName = formatPatientName(study.patient_name)

                                                return (
                                                    <div key={study.id} className="border-l-4 border-blue-500 pl-4 py-2 mb-4">
                                                        <div className="mb-2 flex items-start justify-between gap-3">
                                                            <p className="text-sm font-medium">{shortName}</p>
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(study)}>
                                                                Edit
                                                            </Button>
                                                        </div>
                                                        <p className="text-sm font-medium">
                                                            {study.hospital_discharge_summary_text
                                                                ? study.hospital_discharge_summary_text.charAt(0).toUpperCase() +
                                                                study.hospital_discharge_summary_text.slice(1)
                                                                : ""}
                                                        </p>

                                                        <Citations label="Cited from" quotes={study.hospital_discharge_summary_quotes || []} />

                                                        <p className="text-sm mt-4">
                                                            {study.facility_summary_text
                                                                ? study.facility_summary_text.charAt(0).toUpperCase() + study.facility_summary_text.slice(1)
                                                                : ""}
                                                        </p>
                                                        <Citations label="Cited from" quotes={study.facility_summary_quotes || []} />

                                                        <p className="text-sm mt-4">
                                                            {study.engagement_summary_text
                                                                ? study.engagement_summary_text.charAt(0).toUpperCase() + study.engagement_summary_text.slice(1)
                                                                : ""}
                                                        </p>
                                                        <Citations label="Cited from" quotes={study.engagement_summary_quotes || []} />
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                {selectedCaseStudyPatients.length === 0
                                                    ? "No patients have been assigned to the Case Studies section."
                                                    : "No case studies found for the selected patients."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open && !isSavingStudy) {
                        handleCloseEditDialog()
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit report content</DialogTitle>
                        <DialogDescription>
                            Adjust AI-generated summaries and interventions. Saved changes persist for future reports.
                        </DialogDescription>
                    </DialogHeader>

                    {editedStudy ? (
                        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Patient</Label>
                                <p className="text-sm font-medium text-slate-800">
                                    {formatPatientName(editedStudy.patient_name)}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="highlight-text" className="text-sm font-medium">
                                    Key Highlight
                                </Label>
                                <Textarea
                                    id="highlight-text"
                                    value={editedStudy.highlight_text || ""}
                                    onChange={(event) => handleEditedFieldChange("highlight_text", event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="discharge-summary" className="text-sm font-medium">
                                    Hospital Discharge Summary
                                </Label>
                                <Textarea
                                    id="discharge-summary"
                                    value={editedStudy.hospital_discharge_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("hospital_discharge_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="facility-summary" className="text-sm font-medium">
                                    Facility Summary
                                </Label>
                                <Textarea
                                    id="facility-summary"
                                    value={editedStudy.facility_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("facility_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="engagement-summary" className="text-sm font-medium">
                                    Engagement Summary
                                </Label>
                                <Textarea
                                    id="engagement-summary"
                                    value={editedStudy.engagement_summary_text || ""}
                                    onChange={(event) =>
                                        handleEditedFieldChange("engagement_summary_text", event.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Interventions</h4>
                                {Array.isArray(editedStudy.detailed_interventions) &&
                                editedStudy.detailed_interventions.length > 0 ? (
                                    editedStudy.detailed_interventions.map((item: any, index: number) => (
                                        <div key={`edit-int-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">
                                                Intervention {index + 1}
                                            </Label>
                                            <Textarea
                                                value={item?.intervention || ""}
                                                onChange={(event) =>
                                                    handleDetailedEntryChange(
                                                        "detailed_interventions",
                                                        index,
                                                        "intervention",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">No intervention details available.</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Outcomes</h4>
                                {Array.isArray(editedStudy.detailed_outcomes) &&
                                editedStudy.detailed_outcomes.length > 0 ? (
                                    editedStudy.detailed_outcomes.map((item: any, index: number) => (
                                        <div key={`edit-out-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">
                                                Outcome {index + 1}
                                            </Label>
                                            <Textarea
                                                value={item?.outcome || ""}
                                                onChange={(event) =>
                                                    handleDetailedEntryChange(
                                                        "detailed_outcomes",
                                                        index,
                                                        "outcome",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">No outcome details available.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Select a patient case to edit.</p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSavingStudy}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEditedStudy} disabled={isSavingStudy}>
                            {isSavingStudy ? (
                                <>
                                    Saving
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                </>
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
