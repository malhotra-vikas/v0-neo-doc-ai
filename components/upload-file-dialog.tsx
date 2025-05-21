"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Upload } from "lucide-react"

interface UploadFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nursingHomeId: string
  nursingHomeName: string
  month: string
  year: string
}

export default function UploadFileDialog({
  open,
  onOpenChange,
  nursingHomeId,
  nursingHomeName,
  month,
  year,
}: UploadFileDialogProps) {
  const [fileType, setFileType] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const fileTypes = ["Patients", "CCM", "Non CCM", "Bamboo Report"]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      // Generate a unique file path
      const fileExt = file.name.split(".").pop()
      const fileName = `${nursingHomeName} ${fileType} - ${month} ${year}.${fileExt}`
      const filePath = `${nursingHomeId}/${year}/${month}/${fileName}`

      console.log("Uploading file:", {
        fileName,
        filePath,
        fileSize: file.size,
        fileType: file.type,
      })

      // Upload file to storage
      const { data, error: uploadError } = await supabase.storage.from("nursing-home-files").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        onUploadProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100)
          setUploadProgress(percent)
          console.log(`Upload progress: ${percent}%`)
        },
      })

      if (uploadError) {
        console.error("Storage upload error:", uploadError)
        throw uploadError
      }

      console.log("File uploaded successfully:", data)

      // Get the public URL
      const { data: publicUrlData } = supabase.storage.from("nursing-home-files").getPublicUrl(filePath)

      console.log("Public URL:", publicUrlData)

      // Save file metadata to database
      const { data: insertData, error: dbError } = await supabase
        .from("nursing_home_files")
        .insert([
          {
            nursing_home_id: nursingHomeId,
            file_name: fileName,
            file_type: fileType,
            month,
            year,
            file_path: filePath,
          },
        ])
        .select()

      if (dbError) {
        console.error("Database insert error:", dbError)
        throw dbError
      }

      console.log("Database record inserted:", insertData)

      if (file.type === "application/pdf") {
        const { error: queueError } = await supabase.from("pdf_processing_queue").insert([
          {
            file_id: insertData[0].id,
            file_path: filePath,
            status: "pending",
          },
        ])

        if (queueError) {
          console.error("Queue insert error:", queueError)
          // Don't throw here, just log the error since the file upload was successful
        }
      }

      toast({
        title: "Success",
        description: "File uploaded successfully",
      })

      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      console.error("Upload error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setUploadProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>Upload a monthly file for {nursingHomeName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileType">File Type</Label>
            <Select value={fileType} onValueChange={setFileType} required>
              <SelectTrigger id="fileType">
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                {fileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" type="file" onChange={handleFileChange} required />
            <p className="text-xs text-muted-foreground">Accepted file types: Excel (.xlsx, .xls) or PDF (.pdf)</p>
          </div>

          {uploadProgress !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              <p className="text-xs text-center mt-1">{uploadProgress}% uploaded</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !fileType || !file}>
              {loading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
