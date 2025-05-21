"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"

export function PDFProcessingWorker() {
    const [isProcessing, setIsProcessing] = useState(false)
    const [lastProcessed, setLastProcessed] = useState<Date | null>(null)
    const { toast } = useToast()

    const processQueue = async () => {
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

            if (response.ok) {
                setLastProcessed(new Date())
                // If we successfully processed an item, immediately check for more
                setTimeout(processQueue, 1000)
            } else if (response.status !== 404) {
                // If there was an error (other than "no items in queue")
                console.error("Error processing queue:", result)
                toast({
                    title: "Processing Error",
                    description: result.message || "Failed to process PDF queue",
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Queue processing error:", error)
        } finally {
            setIsProcessing(false)
        }
    }

    useEffect(() => {
        // Start processing when component mounts
        processQueue()

        // Set up interval to check queue every 30 seconds
        const interval = setInterval(processQueue, 30000)

        return () => clearInterval(interval)
    }, [])

    // This component doesn't render anything visible
    return null
}
