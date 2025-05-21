"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// Import the FileText icon
import { FileText, Download, Trash2, FileSearch } from "lucide-react"
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
}

interface PatientFilesTableProps {
  files: FileRecord[]
}

export function PatientFilesTable({ files }: PatientFilesTableProps) {
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      })
    }
  }

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
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/patients/${file.patient_id}/files/${file.id}/view`}>
                          <FileSearch className="h-4 w-4" />
                        </Link>
                      </Button>
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
