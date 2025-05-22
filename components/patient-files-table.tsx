"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, Trash2, FileSearch, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"

// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"

interface FileRecord {
  id: string
  patient_id: string
  file_name: string
  file_type: string
  month: string
  year: string
  file_path: string
  created_at: string
  processing_status?: "pending" | "processing" | "completed" | "failed"
  parsed_text?: string | null
}

interface PatientFilesTableProps {
  files: FileRecord[]
}

export function PatientFilesTable({ files }: PatientFilesTableProps) {
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Update the handleDownload function to log file downloads
  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("nursing-home-files").download(filePath)

      if (error) {
        throw error
      }

      // Create a download link
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Log file download
      const user = await supabase.auth.getUser()
      if (user.data?.user) {
        logAuditEvent({
          user: user.data.user,
          actionType: "download",
          entityType: "patient_file",
          entityId: filePath,
          details: {
            file_name: fileName,
          },
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      })
    }
  }

  // Update the handleDelete function to log file deletions
  const handleDelete = async () => {
    if (!fileToDelete) return

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage.from("nursing-home-files").remove([fileToDelete.file_path])

      if (storageError) {
        throw storageError
      }

      // Delete from database
      const { error: dbError } = await supabase.from("patient_files").delete().eq("id", fileToDelete.id)

      if (dbError) {
        throw dbError
      }

      // Log file deletion
      const user = await supabase.auth.getUser()
      if (user.data?.user) {
        logAuditEvent({
          user: user.data.user,
          actionType: "delete",
          entityType: "patient_file",
          entityId: fileToDelete.id,
          details: {
            file_path: fileToDelete.file_path,
            file_name: fileToDelete.file_name,
            patient_id: fileToDelete.patient_id,
          },
        })
      }

      toast({
        title: "Success",
        description: "File deleted successfully",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      })
    } finally {
      setFileToDelete(null)
    }
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase().endsWith(".pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />
    } else if (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")) {
      return <FileText className="h-4 w-4 text-green-500" />
    } else {
      return <FileText className="h-4 w-4" />
    }
  }

  // Update the handleReprocess function to log reprocessing events
  const handleReprocess = async (fileId: string) => {
    try {
      // Update the file status to pending
      const { error: updateError } = await supabase
        .from("patient_files")
        .update({ processing_status: "pending" })
        .eq("id", fileId)

      if (updateError) {
        throw updateError
      }

      // Get the file path
      const { data: fileData, error: fileError } = await supabase
        .from("patient_files")
        .select("file_path")
        .eq("id", fileId)
        .single()

      if (fileError) {
        throw fileError
      }

      // Add to the processing queue
      const { error: queueError } = await supabase.from("pdf_processing_queue").insert([
        {
          file_id: fileId,
          file_path: fileData.file_path,
          status: "pending",
        },
      ])

      if (queueError) {
        throw queueError
      }

      // Log reprocessing event
      const user = await supabase.auth.getUser()
      if (user.data?.user) {
        logAuditEvent({
          user: user.data.user,
          actionType: "process",
          entityType: "patient_file",
          entityId: fileId,
          details: {
            file_path: fileData.file_path,
            action: "reprocess",
          },
        })
      }

      toast({
        title: "Success",
        description: "File has been queued for processing",
      })

      // Trigger the processing
      fetch("/api/process-pdf-queue", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(console.error) // We don't need to await this

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to queue file for processing",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>File Type</TableHead>
            <TableHead>Month/Year</TableHead>
            <TableHead>Uploaded On</TableHead>
            <TableHead>Processing Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No files found for this patient
              </TableCell>
            </TableRow>
          ) : (
            files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {getFileIcon(file.file_name)}
                    <span className="ml-2">{file.file_name}</span>
                  </div>
                </TableCell>
                <TableCell>{file.file_type}</TableCell>
                <TableCell>{`${file.month} ${file.year}`}</TableCell>
                <TableCell>{new Date(file.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {file.processing_status === "completed" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Processed
                    </span>
                  ) : file.processing_status === "failed" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Failed
                    </span>
                  ) : file.processing_status === "processing" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Processing
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Pending
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(file.file_path, file.file_name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {file.file_name.toLowerCase().endsWith(".pdf") && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/patients/${file.patient_id}/files/${file.id}/view`}>
                            <FileSearch className="h-4 w-4" />
                          </Link>
                        </Button>
                        {(file.processing_status === "failed" || !file.processing_status) && (
                          <Button variant="outline" size="sm" onClick={() => handleReprocess(file.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setFileToDelete(file)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file "{fileToDelete?.file_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
