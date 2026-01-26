"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
    BookOpen,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import type { FailedCaseStudy } from "@/app/(protected)/admin/failed-files/page"

interface FailedCaseStudiesTableProps {
    caseStudies: FailedCaseStudy[]
}

const MAX_SELECTION = 50

export function FailedCaseStudiesTable({ caseStudies }: FailedCaseStudiesTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isRegenerating, setIsRegenerating] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set())
        } else {
            const idsToSelect = caseStudies.slice(0, MAX_SELECTION).map((cs) => cs.patient_id)
            setSelectedIds(new Set(idsToSelect))
            if (caseStudies.length > MAX_SELECTION) {
                toast({
                    title: "Selection limited",
                    description: `Selected first ${MAX_SELECTION} patients. Maximum selection is ${MAX_SELECTION} at a time.`,
                })
            }
        }
    }

    const toggleSelect = (patientId: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(patientId)) {
            newSelected.delete(patientId)
        } else {
            if (newSelected.size >= MAX_SELECTION) {
                toast({
                    title: "Selection limit reached",
                    description: `You can select up to ${MAX_SELECTION} patients at a time.`,
                    variant: "destructive",
                })
                return
            }
            newSelected.add(patientId)
        }
        setSelectedIds(newSelected)
    }

    const regenerateSelected = async () => {
        const patientIds = Array.from(selectedIds)
        if (patientIds.length === 0) {
            toast({
                title: "No patients selected",
                description: "Please select case studies to regenerate",
                variant: "destructive",
            })
            return
        }

        setIsRegenerating(true)
        try {
            const response = await fetch("/api/regenerate-case-studies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientIds }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to regenerate case studies")
            }

            toast({
                title: "Case studies regeneration started",
                description: `Processing ${data.count} patients. ${data.success} succeeded, ${data.failed} failed.`,
            })

            setSelectedIds(new Set())
            setTimeout(() => router.refresh(), 2000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to regenerate case studies",
                variant: "destructive",
            })
        } finally {
            setIsRegenerating(false)
        }
    }

    const regenerateAll = async () => {
        const patientIds = caseStudies.map((cs) => cs.patient_id)
        if (patientIds.length === 0) {
            toast({
                title: "No case studies to regenerate",
                description: "There are no failed case studies to regenerate",
                variant: "destructive",
            })
            return
        }

        setIsRegenerating(true)
        try {
            const response = await fetch("/api/regenerate-case-studies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientIds }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to regenerate case studies")
            }

            toast({
                title: "Case studies regeneration started",
                description: `Processing ${data.count} patients. ${data.success} succeeded, ${data.failed} failed.`,
            })

            setTimeout(() => router.refresh(), 2000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to regenerate case studies",
                variant: "destructive",
            })
        } finally {
            setIsRegenerating(false)
        }
    }

    const regenerateSingle = async (patientId: string) => {
        setIsRegenerating(true)
        try {
            const response = await fetch("/api/regenerate-case-studies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientIds: [patientId] }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to regenerate case study")
            }

            toast({
                title: "Case study regeneration started",
                description: data.success > 0 ? "Case study regenerated successfully" : "Failed to regenerate",
            })

            setTimeout(() => router.refresh(), 2000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to regenerate case study",
                variant: "destructive",
            })
        } finally {
            setIsRegenerating(false)
        }
    }

    return (
        <div>
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.size > 0
                            ? `${selectedIds.size} selected (max ${MAX_SELECTION})`
                            : `Select case studies to regenerate (max ${MAX_SELECTION} at a time)`}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={regenerateSelected}
                        disabled={selectedIds.size === 0 || isRegenerating}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                        Regenerate Selected
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={regenerateAll}
                        disabled={caseStudies.length === 0 || isRegenerating}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                        Regenerate All ({caseStudies.length})
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.size > 0 && selectedIds.size === Math.min(caseStudies.length, MAX_SELECTION)}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label={`Select up to ${MAX_SELECTION} case studies`}
                                />
                            </TableHead>
                            <TableHead className="w-[25%]">Patient Name</TableHead>
                            <TableHead className="w-[25%]">Nursing Home</TableHead>
                            <TableHead className="w-[15%]">Failed Quotes</TableHead>
                            <TableHead className="w-[15%]">Last Updated</TableHead>
                            <TableHead className="w-[20%]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {caseStudies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
                                    <p className="text-lg font-medium">No failed case studies!</p>
                                    <p className="text-sm">All case study quotes are properly extracted.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            caseStudies.map((cs) => (
                                <TableRow key={cs.id} className="group">
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(cs.patient_id)}
                                            onCheckedChange={() => toggleSelect(cs.patient_id)}
                                            aria-label={`Select ${cs.patient_name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center">
                                            <BookOpen className="h-4 w-4 mr-2 text-purple-400" />
                                            <span className="truncate max-w-[200px]" title={cs.patient_name}>
                                                {cs.patient_name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="truncate max-w-[180px] block" title={cs.nursing_home_name || "Unknown"}>
                                            {cs.nursing_home_name || "Unknown"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            {cs.failed_quotes_count} failed
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(cs.updated_at).toLocaleDateString()}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => regenerateSingle(cs.patient_id)}
                                            disabled={isRegenerating}
                                            className="h-8"
                                        >
                                            <RefreshCw className={`h-3 w-3 mr-1 ${isRegenerating ? "animate-spin" : ""}`} />
                                            Regenerate
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
