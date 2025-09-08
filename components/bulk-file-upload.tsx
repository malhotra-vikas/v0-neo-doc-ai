"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  FileUp,
  Info,
  X,
  HelpCircle,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { logger } from "@/lib/logger"
import { logAuditEvent } from "@/lib/audit-logger"
import { extractPdfTextAction } from "@/app/actions/parsePDF"

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
  const [activeTab, setActiveTab] = useState("upload")
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

      // Auto-switch to the files tab when files are selected
      if (selectedFiles.length > 0) {
        setActiveTab("files")
      }
    }
  }

  const removeFile = (index: number) => {
    const newFiles = [...files]
    newFiles.splice(index, 1)
    setFiles(newFiles)
    logger.info(COMPONENT, "File removed", { index, remainingFiles: newFiles.length })
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
      { pattern: /Patient In Facility\d*/i, type: "Patient In Facility" },
      { pattern: /Hospital Stay Notes\d*/i, type: "Patient Hospital Stay Notes" },
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
      let patientCreated = false

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
        patientCreated = true
        logger.info(COMPONENT, "New patient created", { patientId, patientName })

        // Log patient creation
        const user = await supabase.auth.getUser()
        if (user.data?.user) {
          logAuditEvent({
            user: user.data.user,
            actionType: "create",
            entityType: "patient",
            entityId: patientId,
            details: {
              name: patientName,
              nursing_home_id: selectedNursingHomeId,
              created_via: "bulk_upload",
            },
          })
        }
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

      // Convert the Blob to ArrayBuffer for processing
      logger.debug(COMPONENT, "Converting Blob to ArrayBuffer")
      const arrayBufferTimer = logger.timing(COMPONENT, "blob-to-arraybuffer")
      const arrayBuffer = await file.arrayBuffer()
      arrayBufferTimer.end()
      logger.debug(COMPONENT, "Blob converted to ArrayBuffer", { bufferSize: arrayBuffer.byteLength })

      // Extract metadata and text
      let extractedText = ""
      let metadata = { numPages: 0, info: {} }
      const fileName = file.name

/*
      try {
        // Try to get PDF metadata
        logger.info(COMPONENT, "Getting PDF metadata")

        const metadataTimer = logger.timing(COMPONENT, "get-metadata")
        const { text, meta } = await extractPdfTextAction(arrayBuffer);
        metadata = meta

        metadataTimer.end()
        logger.info(COMPONENT, "PDF metadata retrieved", {
          pages: metadata.numPages,
          title: fileName || "Untitled",
        })

        // Try to extract text
        logger.info(COMPONENT, "Extracting text from PDF")
        const extractionTimer = logger.timing(COMPONENT, "extract-text")
        extractedText = text
        extractionTimer.end()

        const textLength = extractedText.length
        logger.info(COMPONENT, "Text extracted successfully", {
          textLength,
          pages: metadata.numPages,
        })
      } catch (pdfError) {
        logger.error(COMPONENT, "Text extraction failed", pdfError)

        // Fallback: Generate basic information about the PDF
        extractedText = `PDF Text Extraction (Fallback Method)\n\n`
        extractedText += `The system was unable to extract text from this PDF.\n`
        extractedText += `This could be due to the PDF being scanned, encrypted, or in an unsupported format.\n\n`
        extractedText += `File Information:\n`
        extractedText += `- File Path: ${filePath}\n`
        extractedText += `- File Size: ${file.size} bytes\n`
        extractedText += `- MIME Type: ${file.type}\n\n`
        extractedText += `For scanned documents, consider using an OCR service to extract text.`

        logger.info(COMPONENT, "Fallback text generated", { textLength: extractedText.length })
      }

      // Format the extracted text with metadata
      logger.debug(COMPONENT, "Formatting extracted text with metadata")
      const formattedText = `
      PDF TEXT EXTRACTION RESULTS
      --------------------------
      File Path: ${filePath}
      File Size: ${file.size} bytes
      Pages: ${metadata.numPages || "Unknown"}
      Title: ${fileName || "Untitled"}
      Extracted: ${new Date().toISOString()}
      
      CONTENT:
      --------------------------
      ${extractedText}
            `.trim()
*/
      // Save file metadata to database
      logger.debug(COMPONENT, "Saving file metadata to database")
      const { data: fileData, error: dbError } = await supabase
        .from("patient_files")
        .insert([
          {
            patient_id: patientId,
            file_name: file.name,
            file_type: fileType,
            month: selectedMonth,
            year: selectedYear,
            file_path: filePath
          },
        ])
        .select()

      if (dbError) {
        logger.error(COMPONENT, "Error saving file metadata", dbError)
        throw dbError
      }

      logger.info(COMPONENT, "File metadata saved successfully")

      // Log file upload
      const user = await supabase.auth.getUser()
      if (user.data?.user && fileData && fileData[0]) {
        logAuditEvent({
          user: user.data.user,
          actionType: "upload",
          entityType: "patient_file",
          entityId: fileData[0].id,
          details: {
            patient_id: patientId,
            patient_name: patientName,
            file_name: file.name,
            file_type: fileType,
            month: selectedMonth,
            year: selectedYear,
            file_size: file.size,
            uploaded_via: "bulk_upload",
          },
        })
      }

      const { data: fileQueryData, error: fileQueryError } = await supabase
        .from("patient_files")
        .select("id")
        .eq("patient_id", patientId)
        .eq("file_path", filePath)
        .single()

      if (fileQueryError) {
        logger.error(COMPONENT, "Error querying file data", fileQueryError)
        throw fileQueryError
      }

      logger.debug(COMPONENT, "Retrieved file ID", { fileId: fileQueryData.id })

      

      // Add the file to the processing queue
      logger.info(COMPONENT, "Adding file to processing queue", { fileId: fileQueryData.id })
      const { error: queueError } = await supabase.from("pdf_processing_queue").insert([
        {
          file_id: fileQueryData.id,
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
        fileId: fileQueryData.id,
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
        title: "Missing Information",
        description: "Please select a nursing home before uploading files.",
        variant: "destructive",
      })
      return
    }

    if (files.length === 0) {
      logger.warn(COMPONENT, "Upload attempted without selecting files")
      toast({
        title: "No Files Selected",
        description: "Please select at least one PDF file to upload.",
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
    setActiveTab("progress")

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
    setActiveTab("results")

    const totalTime = overallTimer.end()
    logger.info(COMPONENT, "Bulk upload completed", {
      totalFiles: files.length,
      successCount: successResults.length,
      errorCount: errorResults.length,
      totalTime,
    })

    toast({
      title: errorResults.length > 0 ? "Upload Completed with Issues" : "Upload Complete",
      description: `Successfully processed ${successResults.length} files${errorResults.length > 0 ? ` with ${errorResults.length} errors` : ""}`,
      variant: errorResults.length > 0 ? "default" : "success",
    })

    // Don't refresh the page automatically so user can see results
    // router.refresh()
  }

  const resetForm = useCallback(() => {
    setFiles([])
    setResults({ success: [], errors: [] })
    setActiveTab("upload")
    logger.info(COMPONENT, "Form reset")
  }, [])

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

  const getFileTypeColor = (fileName: string) => {
    const { fileType } = extractFileInfo(fileName)
    switch (fileType) {
      case "60 Day Unified":
        return "bg-blue-100 text-blue-800"
      case "90 Day Unified":
        return "bg-purple-100 text-purple-800"
      case "SNF Unified":
        return "bg-green-100 text-green-800"
      case "Unified":
        return "bg-teal-100 text-teal-800"
      case "Patient Engagement":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card className="w-full shadow-md border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-slate-800 flex items-center">
              <FileUp className="mr-2 h-5 w-5 text-primary" />
              Bulk Patient File Upload
            </CardTitle>
            <CardDescription className="mt-1">
              Upload multiple patient files at once and automatically create patient records.
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab("help")}>
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Help</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View detailed instructions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none justify-start border-b bg-slate-50">
            <TabsTrigger value="upload" className="data-[state=active]:bg-white">
              <Building2 className="h-4 w-4 mr-2" />
              Facility & Date
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-white">
              <FileText className="h-4 w-4 mr-2" />
              Files
              {files.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                  {files.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="data-[state=active]:bg-white"
              disabled={!uploading && results.success.length === 0 && results.errors.length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="data-[state=active]:bg-white"
              disabled={results.success.length === 0 && results.errors.length === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
            <TabsTrigger value="help" className="data-[state=active]:bg-white">
              <Info className="h-4 w-4 mr-2" />
              Help
            </TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="upload" className="mt-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="nursingHome" className="text-sm font-medium">
                      Nursing Home
                    </Label>
                    <span className="text-red-500 ml-1">*</span>
                  </div>
                  <Select
                    value={selectedNursingHomeId}
                    onValueChange={(value) => {
                      logger.debug(COMPONENT, "Nursing home selected", { nursingHomeId: value })
                      setSelectedNursingHomeId(value)
                    }}
                  >
                    <SelectTrigger id="nursingHome" className="w-full">
                      <SelectValue placeholder="Select nursing home" />
                    </SelectTrigger>
                    <SelectContent>
                      {nursingHomes.length === 0 ? (
                        <div className="p-2 text-center text-sm text-muted-foreground">No nursing homes found</div>
                      ) : (
                        nursingHomes.map((home) => (
                          <SelectItem key={home.id} value={home.id}>
                            {home.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select the nursing home these files belong to.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="month" className="text-sm font-medium">
                        Month
                      </Label>
                      <span className="text-red-500 ml-1">*</span>
                    </div>
                    <Select
                      value={selectedMonth}
                      onValueChange={(value) => {
                        logger.debug(COMPONENT, "Month selected", { month: value })
                        setSelectedMonth(value)
                      }}
                    >
                      <SelectTrigger id="month" className="w-full">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
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
                    <p className="text-xs text-muted-foreground">The month these files are associated with.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="year" className="text-sm font-medium">
                        Year
                      </Label>
                      <span className="text-red-500 ml-1">*</span>
                    </div>
                    <Select
                      value={selectedYear}
                      onValueChange={(value) => {
                        logger.debug(COMPONENT, "Year selected", { year: value })
                        setSelectedYear(value)
                      }}
                    >
                      <SelectTrigger id="year" className="w-full">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
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
                    <p className="text-xs text-muted-foreground">The year these files are associated with.</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => setActiveTab("files")} disabled={!selectedNursingHomeId} className="w-full">
                    Continue to File Selection
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="files" className="text-sm font-medium">
                      Patient Files (PDF)
                    </Label>
                    <span className="text-red-500 ml-1">*</span>
                  </div>
                  <div className="border-2 border-dashed rounded-md p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <Input
                      id="files"
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="space-y-2">
                      <div className="flex justify-center">
                        <FileUp className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Drag and drop files here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload PDF files only. Files should follow the naming convention.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Selected Files ({files.length})</Label>
                      <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="h-8 px-2 text-xs">
                        Clear All
                      </Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <ul className="divide-y">
                        {Array.from(files).map((file, index) => {
                          const { patientName, fileType } = extractFileInfo(file.name)
                          return (
                            <li key={index} className="p-3 flex items-center justify-between hover:bg-slate-50">
                              <div className="flex items-center overflow-hidden">
                                <FileText className="h-5 w-5 mr-3 flex-shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{patientName}</p>
                                  <div className="flex items-center mt-1">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getFileTypeColor(file.name)}`}
                                    >
                                      {fileType}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {(file.size / 1024).toFixed(0)} KB
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="h-8 w-8 p-0 rounded-full"
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("upload")} className="sm:flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0 || !selectedNursingHomeId}
                    className="sm:flex-1"
                  >
                    {uploading ? (
                      "Processing Files..."
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload {files.length} {files.length === 1 ? "File" : "Files"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="progress" className="mt-0">
              <div className="space-y-6">
                <div className="text-center py-4">
                  <h3 className="text-lg font-medium mb-2">Processing Files</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Please wait while your files are being processed. This may take a few minutes.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      Processing file {currentFileIndex + 1} of {files.length}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  {files.length > 0 && currentFileIndex < files.length && (
                    <p className="text-sm text-muted-foreground mt-2">Current file: {files[currentFileIndex].name}</p>
                  )}
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Processing in Progress</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Your files are being uploaded and processed. Each file is being analyzed to extract patient
                    information. Please don't close this window until the process is complete.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="results" className="mt-0">
              <div className="space-y-6">
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <h3 className="text-lg font-medium mb-1">Upload Complete</h3>
                  <p className="text-sm text-muted-foreground">
                    {results.success.length} files processed successfully
                    {results.errors.length > 0 ? ` with ${results.errors.length} errors` : ""}
                  </p>
                </div>

                {results.success.length > 0 && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Success</AlertTitle>
                    <AlertDescription>
                      <div className="max-h-40 overflow-y-auto">
                        <ul className="space-y-1 text-sm text-green-700">
                          {results.success.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {results.errors.length > 0 && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">Errors</AlertTitle>
                    <AlertDescription>
                      <div className="max-h-40 overflow-y-auto">
                        <ul className="space-y-1 text-sm text-red-700">
                          {results.errors.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      router.push("/dashboard")
                    }}
                    className="sm:flex-1"
                  >
                    Return to Dashboard
                  </Button>
                  <Button onClick={resetForm} className="sm:flex-1">
                    Upload More Files
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="help" className="mt-0">
              <div className="space-y-6">
                <div className="text-center py-2">
                  <h3 className="text-lg font-medium mb-2">How It Works</h3>
                  <p className="text-sm text-muted-foreground">Understanding the bulk upload process</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-md border">
                    <h4 className="font-medium flex items-center text-slate-800">
                      <span className="flex h-6 w-6 rounded-full bg-primary text-white items-center justify-center text-xs mr-2">
                        1
                      </span>
                      File Naming
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                      Files should be named with the patient's name followed by the file type. The system supports the
                      following patterns:
                    </p>
                    <ul className="text-sm text-slate-600 list-disc pl-5 mt-2 space-y-1">
                      <li>
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                          "PatientName Patient Engagement.pdf"
                        </code>{" "}
                        (or numbered versions like{" "}
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                          "PatientName Patient Engagement1.pdf"
                        </code>
                        )
                      </li>
                      <li>
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                          "PatientName 90 Day Unified.pdf"
                        </code>
                      </li>
                      <li>
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                          "PatientName 60 Day Unified.pdf"
                        </code>
                      </li>
                      <li>
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">"PatientName SNF Unified.pdf"</code>
                      </li>
                      <li>
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">"PatientName Unified.pdf"</code>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md border">
                    <h4 className="font-medium flex items-center text-slate-800">
                      <span className="flex h-6 w-6 rounded-full bg-primary text-white items-center justify-center text-xs mr-2">
                        2
                      </span>
                      Patient Creation
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                      The system will automatically create patient records based on the filenames if they don't already
                      exist. If a patient with the same name already exists in the selected nursing home, the file will
                      be associated with that patient.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md border">
                    <h4 className="font-medium flex items-center text-slate-800">
                      <span className="flex h-6 w-6 rounded-full bg-primary text-white items-center justify-center text-xs mr-2">
                        3
                      </span>
                      File Types
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                      Files are categorized based on their names. For example, files containing "90 Day Unified" will be
                      categorized as "90 Day Unified", files with "Patient Engagement" (with or without a number) will
                      be categorized as "Patient Engagement", etc.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md border">
                    <h4 className="font-medium flex items-center text-slate-800">
                      <span className="flex h-6 w-6 rounded-full bg-primary text-white items-center justify-center text-xs mr-2">
                        4
                      </span>
                      Text Extraction
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                      After upload, the system will automatically extract text from the PDF files. This process happens
                      in the background and may take some time depending on the size and number of files.
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => setActiveTab("upload")} className="w-full">
                    Return to Upload
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t px-6 py-4">
        <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="text-xs text-muted-foreground">
            <p>Files will be organized by patient, year, and month.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedNursingHome && (
              <Badge variant="outline" className="bg-white">
                <Building2 className="h-3 w-3 mr-1" />
                {selectedNursingHome.name}
              </Badge>
            )}
            <Badge variant="outline" className="bg-white">
              <Calendar className="h-3 w-3 mr-1" />
              {selectedMonth} {selectedYear}
            </Badge>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
