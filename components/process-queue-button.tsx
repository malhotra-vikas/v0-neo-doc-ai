"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { logAuditEvent } from "@/lib/audit-logger"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useAuth } from "./providers/auth-provider"

export function ProcessQueueButton() {
    const [isProcessing, setIsProcessing] = useState(false)
    const { toast } = useToast()
    const router = useRouter()
    const { user } = useAuth() 

    const handleProcessQueue = async () => {
        if (isProcessing) return

        setIsProcessing(true)

        try {
            const response = await fetch("/api/process-pdf-queue", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            const result = await response.json()
            const supabase = createClientComponentClient()

            // Log the processing event
            if (user) {
                logAuditEvent({
                    user: user,
                    actionType: "process",
                    entityType: "pdf_queue",
                    entityId: result.file_id || "batch",
                    details: {
                        status: response.ok ? "success" : response.status === 404 ? "no_items" : "error",
                        message: result.message,
                    },
                })
            }

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Successfully processed a queue item",
                })
            } else if (response.status === 404) {
                toast({
                    title: "No Items",
                    description: "No pending items in the queue",
                })
            } else {
                toast({
                    title: "Error",
                    description: result.message || "Failed to process queue",
                    variant: "destructive",
                })
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to connect to processing service",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
            router.refresh()
        }
    }

    return (
        <Button onClick={handleProcessQueue} disabled={isProcessing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
            {isProcessing ? "Processing..." : "Process Next Item"}
        </Button>
    )
}
