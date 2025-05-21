"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface NursingHome {
  id: string
  name: string
}

interface BulkFileUploadProps {
  nursingHomes: NursingHome[]
}

export function BulkFileUpload({ nursingHomes }: BulkFileUploadProps) {
  const [selectedNursingHomeId, setSelectedNursingHomeId] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString("default", { month: "long" }))
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [results, setResults] = useState<{ success: string[]; errors: string[] }>({ success: [], errors: [] })
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const processFile = async (file: File) => {
    try {
      // Extract patient name from filename
      // Assuming filename format: "PatientName FileType.pdf"
      let patientName = file.name.split(".")[0] // Remove file extension

      // If the filename contains spaces, assume the format is "FirstName LastName FileType.pdf"
      // and extract just the name part
      if (patientName.includes(" ")) {
        // Look for common file type indicators in the name
        const fileTypeIndicators = ["Patient Engagement", "90 Day Unified", "Unified", "Engagement"]

        let nameEndIndex = patientName.length
        for (const indicator of fileTypeIndicators) {
          const index = patientName.indexOf(indicator)
          if (index > 0) {
            nameEndIndex = Math.min(nameEndIndex, index)
          }
        }

        patientName = patientName.substring(0, nameEndIndex).trim()
      }

      // Check if patient already exists
      const { data: existingPatients, error: searchError } = await supabase
        .from("patients")
        .select("id")
        .eq("name", patientName)
        .eq("nursing_home_id", selectedNursingHomeId)

      if (searchError) {
        throw searchError
      }

      let patientId: string

      // If patient doesn't exist, create a new patient record
      if (!existingPatients || existingPatients.length === 0) {
        const { data: newPatient, error: createError } = await supabase
          .from("patients")
          .insert([
            {
              name: patientName,
              nursing_home_id: selectedNursingHomeId,
            },
          ])
          .select()

        if (createError) {
          throw createError
        }

        patientId = newPatient[0].id
      } else {
        patientId = existingPatients[0].id
      }

      // Upload the file to storage
      const filePath = `patients/${patientId}/${selectedYear}/${selectedMonth}/${file.name}`

      const { error: uploadError } = await supabase.storage.from("nursing-home-files").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

      if (uploadError) {
        throw uploadError
      }

      // Determine file type based on filename
      let fileType = "Patient Engagement"
      if (file.name.toLowerCase().includes("unified")) {
        fileType = "90 Day Unified"
      }

      // Save file metadata to database
      const { error: dbError } = await supabase.from("patient_files").insert([
        {
          patient_id: patientId,
          file_name: file.name,
          file_type: fileType,
          month: selectedMonth,
          year: selectedYear,
          file_path: filePath,
        },
      ])

      if (dbError) {
        throw dbError
      }

      return { success: true, message: `Successfully processed ${file.name} for patient ${patientName}` }
    } catch (error: any) {
      console.error("Error processing file:", error)
      return { success: false, message: `Error processing ${file.name}: ${error.message}` }
    }
  }

  const handleUpload = async () => {
    if (!selectedNursingHomeId) {
      toast({
        title: "Error",
        description: "Please select a nursing home",
        variant: "destructive",
      })
      return
    }

    if (files.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setCurrentFileIndex(0)
    setUploadProgress(0)
    setResults({ success: [], errors: [] })

    const successResults: string[] = []
    const errorResults: string[] = []

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i)
      setUploadProgress(Math.round((i / files.length) * 100))

      const result = await processFile(files[i])

      if (result.success) {
        successResults.push(result.message)
      } else {
        errorResults.push(result.message)
      }
    }

    setUploadProgress(100)
    setResults({ success: successResults, errors: errorResults })
    setUploading(false)

    toast({
      title: "Upload Complete",
      description: `Successfully processed ${successResults.length} files with ${errorResults.length} errors`,
    })

    router.refresh()
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

  const selectedNursingHome = nursingHomes.find((home) => home.id === selectedNursingHomeId)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Patient Files</CardTitle>
        <CardDescription>
          Upload PDF files for patients. The system will automatically create patient records based on filenames.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="nursingHome">Nursing Home</Label>
          <Select value={selectedNursingHomeId} onValueChange={setSelectedNursingHomeId}>
            <SelectTrigger id="nursingHome">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year">
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
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="files">Patient Files (PDF)</Label>
          <Input id="files" type="file" multiple accept=".pdf" onChange={handleFileChange} />
          <p className="text-xs text-muted-foreground">
            Upload patient PDF files. Patient records will be created based on filenames.
          </p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Files ({files.length})</Label>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              <ul className="space-y-1">
                {Array.from(files).map((file, index) => (
                  <li key={index} className="text-sm flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Processing file {currentFileIndex + 1} of {files.length}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {results.success.length > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              <div className="max-h-40 overflow-y-auto">
                <ul className="space-y-1 text-sm">
                  {results.success.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {results.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errors</AlertTitle>
            <AlertDescription>
              <div className="max-h-40 overflow-y-auto">
                <ul className="space-y-1 text-sm">
                  {results.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          disabled={uploading || files.length === 0 || !selectedNursingHomeId}
          className="w-full"
        >
          {uploading ? (
            "Processing Files..."
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload and Process Files
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
