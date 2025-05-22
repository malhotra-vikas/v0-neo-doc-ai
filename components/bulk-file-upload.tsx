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
import { logger } from "@/lib/logger"

const COMPONENT = "BulkFileUpload"

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

  logger.debug(COMPONENT, "Component rendered", {
    nursingHomesCount: nursingHomes.length,
    selectedMonth,
    selectedYear,
    filesCount: files.length,
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)

      logger.info(COMPONENT, "Files selected", {
        count: selectedFiles.length,
        fileNames: selectedFiles.map((f) => f.name),
        totalSize: selectedFiles.reduce((sum, f) => sum + f.size, 0),
      })
    }
  }

  // Function to extract patient name and file type from filename
  const extractFileInfo = (filename: string) => {
    logger.debug(COMPONENT, "Extracting file info", { filename })

    // Remove file extension
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, "")
    logger.debug(COMPONENT, "Name without extension", { nameWithoutExtension })

    // Define file type patterns to look for
    const fileTypePatterns = [
      { pattern: /60 Day Unified/i, type: "60 Day Unified" },
      { pattern: /90 Day Unified/i, type: "90 Day Unified" },
      { pattern: /SNF Unified/i, type: "SNF Unified" },
      { pattern: /Unified/i, type: "Unified" },
      { pattern: /Patient Engagement\d*/i, type: "Patient Engagement" },
    ]

    // Find the first matching pattern
    let fileType = "Patient Engagement" // Default file type
    let patientName = nameWithoutExtension // Default to full name without extension

    for (const { pattern, type } of fileTypePatterns) {
      const match = nameWithoutExtension.match(pattern)
      if (match) {
        fileType = type
        // Extract patient name by removing the file type from the filename
        const matchIndex = nameWithoutExtension.indexOf(match[0])
        if (matchIndex > 0) {
          patientName = nameWithoutExtension.substring(0, matchIndex).trim()
        }
        logger.debug(COMPONENT, "Pattern matched", { pattern: pattern.toString(), type, matchIndex })
        break
      }
    }

    // If no specific pattern was found but there are multiple words,
    // assume the last word(s) might be a file type indicator
    if (fileType === "Patient Engagement" && !nameWithoutExtension.includes("Patient Engagement")) {
      const parts = nameWithoutExtension.split(" ")
      if (parts.length > 1) {
        // Assume the patient name is all but the last word
        // This is a fallback and might not be accurate for all cases
        patientName = parts.slice(0, -1).join(" ").trim()
        logger.debug(COMPONENT, "Using fallback name extraction", { parts, extractedName: patientName })
      }
    }

    logger.info(COMPONENT, "File info extracted", { filename, patientName, fileType })
    return { patientName, fileType }
  }

  const processFile = async (file: File) => {
    const timer = logger.timing(COMPONENT, `processFile-${file.name}`)
    logger.info(COMPONENT, "Processing file", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })

    try {
      // Extract patient name and file type from filename
      const { patientName, fileType } = extractFileInfo(file.name)

      if (!patientName) {
        logger.error(COMPONENT, "Could not extract patient name", { fileName: file.name })
        throw new Error(`Could not extract patient name from ${file.name}`)
      }

      // Check if patient already exists
      logger.debug(COMPONENT, "Checking if patient exists", {
        patientName,
        nursingHomeId: selectedNursingHomeId,
      })

      const { data: existingPatients, error: searchError } = await supabase
        .from("patients")
        .select("id")
        .eq("name", patientName)
        .eq("nursing_home_id", selectedNursingHomeId)

      if (searchError) {
        logger.error(COMPONENT, "Error searching for patient", searchError)
        throw searchError
      }

      let patientId: string

      // If patient doesn't exist, create a new patient record
      if (!existingPatients || existingPatients.length === 0) {
        logger.info(COMPONENT, "Patient not found, creating new patient", { patientName })

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
          logger.error(COMPONENT, "Error creating patient", createError)
          throw createError
        }

        patientId = newPatient[0].id
        logger.info(COMPONENT, "New patient created", { patientId, patientName })
      } else {
        patientId = existingPatients[0].id
        logger.info(COMPONENT, "Existing patient found", { patientId, patientName })
      }

      // Upload the file to storage
      const filePath = `patients/${patientId}/${selectedYear}/${selectedMonth}/${file.name}`
      logger.info(COMPONENT, "Uploading file to storage", { filePath })

      const uploadTimer = logger.timing(COMPONENT, `upload-${file.name}`)
      const { error: uploadError } = await supabase.storage.from("nursing-home-files").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })
      uploadTimer.end()

      if (uploadError) {
        logger.error(COMPONENT, "Error uploading file", uploadError)
        throw uploadError
      }

      logger.info(COMPONENT, "File uploaded successfully", { filePath })

      // Save file metadata to database
      logger.debug(COMPONENT, "Saving file metadata to database")
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
        logger.error(COMPONENT, "Error saving file metadata", dbError)
        throw dbError
      }

      logger.info(COMPONENT, "File metadata saved successfully")

      const { data: fileData, error: fileQueryError } = await supabase
        .from("patient_files")
        .select("id")
        .eq("patient_id", patientId)
        .eq("file_path", filePath)
        .single()

      if (fileQueryError) {
        logger.error(COMPONENT, "Error querying file data", fileQueryError)
        throw fileQueryError
      }

      logger.debug(COMPONENT, "Retrieved file ID", { fileId: fileData.id })

      // Add the file to the processing queue
      logger.info(COMPONENT, "Adding file to processing queue", { fileId: fileData.id })
      const { error: queueError } = await supabase.from("pdf_processing_queue").insert([
        {
          file_id: fileData.id,
          file_path: filePath,
          status: "pending",
        },
      ])

      if (queueError) {
        logger.error(COMPONENT, "Error adding file to queue", queueError)
        throw queueError
      }

      logger.info(COMPONENT, "File added to processing queue successfully")

      const processingTime = timer.end()
      logger.info(COMPONENT, "File processing completed", {
        fileName: file.name,
        processingTime,
        patientId,
        fileId: fileData.id,
      })

      return { success: true, message: `Successfully processed ${file.name} for patient ${patientName}` }
    } catch (error: any) {
      logger.error(COMPONENT, "Error processing file", error)
      timer.end()
      return { success: false, message: `Error processing ${file.name}: ${error.message}` }
    }
  }

  const handleUpload = async () => {
    if (!selectedNursingHomeId) {
      logger.warn(COMPONENT, "Upload attempted without selecting nursing home")
      toast({
        title: "Error",
        description: "Please select a nursing home",
        variant: "destructive",
      })
      return
    }

    if (files.length === 0) {
      logger.warn(COMPONENT, "Upload attempted without selecting files")
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      })
      return
    }

    const overallTimer = logger.timing(COMPONENT, "bulk-upload")
    logger.info(COMPONENT, "Starting bulk upload", {
      fileCount: files.length,
      nursingHomeId: selectedNursingHomeId,
      month: selectedMonth,
      year: selectedYear,
    })

    setUploading(true)
    setCurrentFileIndex(0)
    setUploadProgress(0)
    setResults({ success: [], errors: [] })

    const successResults: string[] = []
    const errorResults: string[] = []

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i)
      const progressPercent = Math.round((i / files.length) * 100)
      setUploadProgress(progressPercent)
      logger.debug(COMPONENT, "Processing file in batch", {
        index: i,
        fileName: files[i].name,
        progress: `${progressPercent}%`,
      })

      const result = await processFile(files[i])

      if (result.success) {
        successResults.push(result.message)
        logger.debug(COMPONENT, "File processed successfully", { fileName: files[i].name })
      } else {
        errorResults.push(result.message)
        logger.error(COMPONENT, "File processing failed", {
          fileName: files[i].name,
          error: result.message,
        })
      }
    }

    setUploadProgress(100)
    setResults({ success: successResults, errors: errorResults })
    setUploading(false)

    const totalTime = overallTimer.end()
    logger.info(COMPONENT, "Bulk upload completed", {
      totalFiles: files.length,
      successCount: successResults.length,
      errorCount: errorResults.length,
      totalTime,
    })

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
          <Select
            value={selectedNursingHomeId}
            onValueChange={(value) => {
              logger.debug(COMPONENT, "Nursing home selected", { nursingHomeId: value })
              setSelectedNursingHomeId(value)
            }}
          >
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
            <Select
              value={selectedMonth}
              onValueChange={(value) => {
                logger.debug(COMPONENT, "Month selected", { month: value })
                setSelectedMonth(value)
              }}
            >
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
            <Select
              value={selectedYear}
              onValueChange={(value) => {
                logger.debug(COMPONENT, "Year selected", { year: value })
                setSelectedYear(value)
              }}
            >
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
