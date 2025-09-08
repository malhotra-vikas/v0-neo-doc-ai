"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"

const COMPONENT = "PDFProcessingWorker"

export function PDFProcessingWorker() {
    const [isProcessing, setIsProcessing] = useState(false)
    const [lastProcessed, setLastProcessed] = useState<Date | null>(null)
    const [consecutiveErrors, setConsecutiveErrors] = useState(0)
    const { toast } = useToast()

    logger.debug(COMPONENT, "Component rendered", {
        isProcessing,
        lastProcessed: lastProcessed?.toISOString(),
        consecutiveErrors,
    })

    const processQueue = async () => {
        if (isProcessing) {
            logger.debug(COMPONENT, "Already processing, skipping")
            return
        }

        logger.info(COMPONENT, "Starting queue processing")
        setIsProcessing(true)

        try {
            const timer = logger.timing(COMPONENT, "process-queue-request")
            logger.debug(COMPONENT, "Fetching next item from queue")

            const response = await fetch("/api/process-pdf-queue", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            const result = await response.json()
            const requestTime = timer.end()

            logger.debug(COMPONENT, "Queue processing response received", {
                status: response.status,
                requestTime,
            })

            if (response.ok) {
                logger.info(COMPONENT, "PDF processed successfully", {
                    fileId: result.file_id,
                    metadata: result.metadata,
                })

                setLastProcessed(new Date())
                setConsecutiveErrors(0)

                // If we successfully processed an item, immediately check for more
                logger.debug(COMPONENT, "Scheduling immediate check for more items")
                setTimeout(processQueue, 5000)
            } else if (response.status === 404) {
                // No items in queue - this is normal
                logger.debug(COMPONENT, "No items in queue")
                setConsecutiveErrors(0)
            } else {
                // If there was an error
                logger.error(COMPONENT, "Error processing queue", result)
                setConsecutiveErrors((prev) => prev + 1)

                // Only show toast for persistent errors
                if (consecutiveErrors > 2) {
                    logger.warn(COMPONENT, "Persistent errors detected, showing toast", {
                        consecutiveErrors,
                    })

                    toast({
                        title: "Processing Error",
                        description: result.message || "Failed to process PDF queue",
                        variant: "destructive",
                    })
                }
            }
        } catch (error: any) {
            logger.error(COMPONENT, "Queue processing error", error)
            setConsecutiveErrors((prev) => prev + 1)

            // Only show toast for persistent errors
            if (consecutiveErrors > 2) {
                logger.warn(COMPONENT, "Persistent connection errors detected, showing toast", {
                    consecutiveErrors,
                })

                toast({
                    title: "Processing Error",
                    description: error.message || "Failed to connect to PDF processing service",
                    variant: "destructive",
                })
            }
        } finally {
            setIsProcessing(false)
        }
    }

    useEffect(() => {
        logger.info(COMPONENT, "Worker initialized")

        // Start processing when component mounts, but with a delay
        logger.debug(COMPONENT, "Scheduling initial queue check")
        const initialTimer = setTimeout(() => {
            logger.debug(COMPONENT, "Running initial queue check")
            processQueue()
        }, 5000)

        // Set up interval to check queue every 30 seconds
        logger.debug(COMPONENT, "Setting up recurring queue check interval")
        const interval = setInterval(() => {
            logger.debug(COMPONENT, "Running scheduled queue check")
            processQueue()
        }, 30000)

        return () => {
            logger.info(COMPONENT, "Worker cleanup")
            clearTimeout(initialTimer)
            clearInterval(interval)
        }
    }, [])

    // This component doesn't render anything visible
    return null
}
