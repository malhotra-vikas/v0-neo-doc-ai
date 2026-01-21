"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
    FileText,
    RefreshCw,
    AlertTriangle,
    Sparkles,
    CheckCircle,
    Loader2,
    Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { logAuditEvent } from "@/lib/audit-logger"

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

interface FailedFilesTableProps {
    files: FailedFile[]
}

const MAX_SELECTION = 100

export function FailedFilesTable({ files }: FailedFilesTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isReprocessing, setIsReprocessing] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [processingFileId, setProcessingFileId] = useState<string | null>(null)
    const { toast } = useToast()
    const router = useRouter()
    const supabase = createClientComponentClient()

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            // If any files are selected, deselect all
            setSelectedIds(new Set())
        } else {
            // Select up to MAX_SELECTION files
            const filesToSelect = files.slice(0, MAX_SELECTION).map((f) => f.id)
            setSelectedIds(new Set(filesToSelect))
            if (files.length > MAX_SELECTION) {
                toast({
                    title: "Selection limited",
                    description: `Selected first ${MAX_SELECTION} files. Maximum selection is ${MAX_SELECTION} files at a time.`,
                })
            }
        }
    }

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            if (newSelected.size >= MAX_SELECTION) {
                toast({
                    title: "Selection limit reached",
                    description: `You can select up to ${MAX_SELECTION} files at a time. Deselect some files first.`,
                    variant: "destructive",
                })
                return
            }
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const reprocessSingleFile = async (fileId: string, filePath: string) => {
        setProcessingFileId(fileId)
        try {
            // Update file status to pending
            const { error: updateError } = await supabase
                .from("patient_files")
                .update({ processing_status: "pending" })
                .eq("id", fileId)

            if (updateError) throw updateError

            // Check for existing queue item
            const { data: existingItem, error: checkError } = await supabase
                .from("pdf_processing_queue")
                .select("id, status")
                .eq("file_id", fileId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single()

            if (checkError && checkError.code !== "PGRST116") {
                throw checkError
            }

            if (existingItem) {
                const { error: queueUpdateError } = await supabase
                    .from("pdf_processing_queue")
                    .update({ status: "pending", processed_at: null })
                    .eq("id", existingItem.id)

                if (queueUpdateError) throw queueUpdateError
            } else {
                const { error: insertError } = await supabase
                    .from("pdf_processing_queue")
                    .insert([{ file_id: fileId, file_path: filePath, status: "pending" }])

                if (insertError) throw insertError
            }

            // Log audit event
            const user = await supabase.auth.getUser()
            if (user.data?.user) {
                logAuditEvent({
                    user: user.data.user,
                    actionType: "process",
                    entityType: "patient_file",
                    entityId: fileId,
                    details: { action: "reprocess", initiated_from: "failed_files_page" },
                })
            }

            // Trigger processing
            fetch("/api/process-pdf-queue", { method: "GET" }).catch(console.error)

            toast({
                title: "Queued for reprocessing",
                description: "File has been queued for reprocessing",
            })

            setTimeout(() => router.refresh(), 1000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to reprocess file",
                variant: "destructive",
            })
        } finally {
            setProcessingFileId(null)
        }
    }

    const reprocessSelected = async () => {
        if (selectedIds.size === 0) {
            toast({
                title: "No files selected",
                description: "Please select files to reprocess",
                variant: "destructive",
            })
            return
        }

        setIsReprocessing(true)
        try {
            const response = await fetch("/api/reprocess-failed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to reprocess files")
            }

            toast({
                title: "Files queued for reprocessing",
                description: `${data.count} files have been queued for reprocessing`,
            })

            setSelectedIds(new Set())
            setTimeout(() => router.refresh(), 1000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to reprocess files",
                variant: "destructive",
            })
        } finally {
            setIsReprocessing(false)
        }
    }

    const reprocessAll = async () => {
        setIsReprocessing(true)
        try {
            const response = await fetch("/api/reprocess-failed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to reprocess files")
            }

            toast({
                title: "All files queued for reprocessing",
                description: `${data.count} files have been queued for reprocessing`,
            })

            setTimeout(() => router.refresh(), 1000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to reprocess files",
                variant: "destructive",
            })
        } finally {
            setIsReprocessing(false)
        }
    }

    const regenerateCaseStudies = async () => {
        // Get unique patient IDs from selected files, or all files if none selected
        const patientIds = selectedIds.size > 0
            ? Array.from(new Set(
                files
                    .filter((f) => selectedIds.has(f.id))
                    .map((f) => f.patient_id)
                    .filter(Boolean)
            ))
            : Array.from(new Set(files.map((f) => f.patient_id).filter(Boolean)))

        if (patientIds.length === 0) {
            toast({
                title: "No patients found",
                description: "No patients to regenerate case studies for",
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
                description: `Processing ${data.count} patients. This may take a few minutes.`,
            })
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

    return (
        <div>
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.size > 0
                            ? `${selectedIds.size} selected (max ${MAX_SELECTION})`
                            : `Select files to reprocess (max ${MAX_SELECTION} at a time)`}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={reprocessSelected}
                        disabled={selectedIds.size === 0 || isReprocessing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isReprocessing ? "animate-spin" : ""}`} />
                        Reprocess Selected
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
                                    checked={selectedIds.size > 0 && selectedIds.size === Math.min(files.length, MAX_SELECTION)}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label={`Select up to ${MAX_SELECTION} files`}
                                />
                            </TableHead>
                            <TableHead className="w-[25%]">File Name</TableHead>
                            <TableHead className="w-[15%]">Patient</TableHead>
                            <TableHead className="w-[15%]">Nursing Home</TableHead>
                            <TableHead className="w-[12%]">File Type</TableHead>
                            <TableHead className="w-[10%]">Period</TableHead>
                            <TableHead className="w-[10%]">Status</TableHead>
                            <TableHead className="w-[13%]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
                                    <p className="text-lg font-medium">No failed files!</p>
                                    <p className="text-sm">All PDF extractions are working correctly.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            files.map((file) => (
                                <TableRow key={file.id} className="group">
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(file.id)}
                                            onCheckedChange={() => toggleSelect(file.id)}
                                            aria-label={`Select ${file.file_name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center">
                                            <FileText className="h-4 w-4 mr-2 text-red-400" />
                                            <span className="truncate max-w-[200px]" title={file.file_name}>
                                                {file.file_name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="truncate max-w-[120px] block" title={file.patients?.name}>
                                            {file.patients?.name || "Unknown"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="truncate max-w-[120px] block" title={file.patients?.nursing_homes?.name}>
                                            {file.patients?.nursing_homes?.name || "Unknown"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {file.file_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {file.month} {file.year}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {file.processing_status === "pending" ? (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                <Clock className="h-3 w-3 mr-1" />
                                                Pending
                                            </Badge>
                                        ) : file.processing_status === "processing" ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                Processing
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                Failed
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => reprocessSingleFile(file.id, file.file_path)}
                                            disabled={processingFileId === file.id || file.processing_status === "pending" || file.processing_status === "processing"}
                                            className="h-8"
                                        >
                                            <RefreshCw className={`h-3 w-3 mr-1 ${processingFileId === file.id ? "animate-spin" : ""}`} />
                                            Reprocess
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
