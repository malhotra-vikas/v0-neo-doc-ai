"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, FileText, Download, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import UploadFileDialog from "./upload-file-dialog"
// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"

interface NursingHome {
  id: string
  name: string
}

interface FileRecord {
  id: string
  nursing_home_id: string
  file_name: string
  file_type: string
  month: string
  year: string
  file_path: string
  created_at: string
}

interface FileManagementProps {
  nursingHomes: NursingHome[]
  files: FileRecord[]
}

export default function FileManagement({ nursingHomes, files }: FileManagementProps) {
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(
    nursingHomes.length > 0 ? nursingHomes[0].id : null,
  )
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString("default", { month: "long" }))
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const filteredFiles = files.filter(
    (file) => file.nursing_home_id === selectedHomeId && file.month === selectedMonth && file.year === selectedYear,
  )

  const selectedHome = nursingHomes.find((home) => home.id === selectedHomeId)

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
          entityType: "nursing_home_file",
          entityId: filePath,
          details: {
            file_name: fileName,
            nursing_home_id: selectedHomeId,
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
  const handleDelete = async (id: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage.from("nursing-home-files").remove([filePath])

      if (storageError) {
        throw storageError
      }

      // Delete from database
      const { error: dbError } = await supabase.from("nursing_home_files").delete().eq("id", id)

      if (dbError) {
        throw dbError
      }

      // Log file deletion
      const user = await supabase.auth.getUser()
      if (user.data?.user) {
        logAuditEvent({
          user: user.data.user,
          actionType: "delete",
          entityType: "nursing_home_file",
          entityId: id,
          details: {
            file_path: filePath,
            nursing_home_id: selectedHomeId,
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
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Files</CardTitle>
          <CardDescription>Manage monthly files for nursing homes</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedHomeId || ""} onValueChange={(value) => setSelectedHomeId(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select nursing home" />
            </SelectTrigger>
            <SelectContent>
              {nursingHomes.map((home) => (
                <SelectItem key={home.id} value={home.id}>
                  {home.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setIsUploadDialogOpen(true)} disabled={!selectedHomeId}>
            <Plus className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>File Type</TableHead>
              <TableHead>Uploaded On</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!selectedHomeId ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Please select a nursing home
                </TableCell>
              </TableRow>
            ) : filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No files found for {selectedHome?.name} in {selectedMonth} {selectedYear}
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      {file.file_name}
                    </div>
                  </TableCell>
                  <TableCell>{file.file_type}</TableCell>
                  <TableCell>{new Date(file.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file.file_path, file.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(file.id, file.file_path)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {selectedHomeId && (
        <UploadFileDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          nursingHomeId={selectedHomeId}
          nursingHomeName={selectedHome?.name || ""}
          month={selectedMonth}
          year={selectedYear}
        />
      )}
    </Card>
  )
}
