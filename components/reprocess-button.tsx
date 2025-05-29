"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"

interface ReprocessButtonProps {
    fileId: string
}

export function ReprocessButton({ fileId }: ReprocessButtonProps) {
    const [isProcessing, setIsProcessing] = useState(false)
    const { toast } = useToast()
    const router = useRouter()
    const supabase = createClientComponentClient()

    // Update the handleReprocess function to log reprocessing events
    const handleReprocess = async () => {
        if (isProcessing) return

        setIsProcessing(true)

        try {
            // First, update the file status to pending
            const { error: updateError } = await supabase
                .from("patient_files")
                .update({ processing_status: "pending" })
                .eq("id", fileId)

            if (updateError) {
                throw updateError
            }

            // Check if there's already a queue item for this file
            const { data: existingItem, error: checkError } = await supabase
                .from("pdf_processing_queue")
                .select("id, status")
                .eq("file_id", fileId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single()

            if (checkError && checkError.code !== "PGRST116") {
                // PGRST116 is the error code for "no rows returned" which is fine
                throw checkError
            }

            if (existingItem) {
                // Update the existing queue item
                const { error: queueUpdateError } = await supabase
                    .from("pdf_processing_queue")
                    .update({ status: "pending", processed_at: null })
                    .eq("id", existingItem.id)

                if (queueUpdateError) {
                    throw queueUpdateError
                }
            } else {
                // Get the file path
                const { data: fileData, error: fileError } = await supabase
                    .from("patient_files")
                    .select("file_path")
                    .eq("id", fileId)
                    .single()

                if (fileError) {
                    throw fileError
                }

                // Create a new queue item
                const { error: insertError } = await supabase.from("pdf_processing_queue").insert([
                    {
                        file_id: fileId,
                        file_path: fileData.file_path,
                        status: "pending",
                    },
                ])

                if (insertError) {
                    throw insertError
                }
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
                        action: "reprocess",
                        initiated_from: "reprocess_button",
                    },
                })
            }

            toast({
                title: "Success",
                description: "File has been queued for reprocessing",
            })

            // Trigger the processing
            fetch("/api/process-pdf-queue", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }).catch(console.error) // We don't need to await this

            // Refresh the page after a short delay
            setTimeout(() => {
                router.refresh()
            }, 1000)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to reprocess file",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Button onClick={handleReprocess} disabled={isProcessing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
            {isProcessing ? "Reprocessing..." : "Reprocess File"}
        </Button>
    )
}
