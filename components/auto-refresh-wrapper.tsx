"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pause, Play, RefreshCw, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { logAuditEvent } from "@/lib/audit-logger"

interface AutoRefreshWrapperProps {
    children: ReactNode
    userId: string
    pageName: string
}

export function AutoRefreshWrapper({ children, userId, pageName }: AutoRefreshWrapperProps) {
    const router = useRouter()
    const [isPaused, setIsPaused] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefreshed, setLastRefreshed] = useState(new Date())
    const [mounted, setMounted] = useState(false);

    const [refreshInterval, setRefreshInterval] = useState(30) // seconds
    const [timeRemaining, setTimeRemaining] = useState(refreshInterval)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const userActivityRef = useRef<NodeJS.Timeout | null>(null)
    const [userActive, setUserActive] = useState(false)

    // Handle user activity detection
    useEffect(() => {
        const handleUserActivity = () => {
            setUserActive(true)

            // Clear existing timeout
            if (userActivityRef.current) {
                clearTimeout(userActivityRef.current)
            }

            // Set a new timeout to mark user as inactive after 5 seconds
            userActivityRef.current = setTimeout(() => {
                setUserActive(false)
            }, 5000)
        }

        // Add event listeners for user activity
        window.addEventListener("mousemove", handleUserActivity)
        window.addEventListener("keydown", handleUserActivity)
        window.addEventListener("click", handleUserActivity)
        window.addEventListener("scroll", handleUserActivity)

        return () => {
            // Clean up event listeners
            window.removeEventListener("mousemove", handleUserActivity)
            window.removeEventListener("keydown", handleUserActivity)
            window.removeEventListener("click", handleUserActivity)
            window.removeEventListener("scroll", handleUserActivity)

            // Clear timeout
            if (userActivityRef.current) {
                clearTimeout(userActivityRef.current)
            }
        }
    }, [])

    // Set up the refresh timer
    useEffect(() => {
        const startTimer = () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }

            timerRef.current = setInterval(() => {
                setTimeRemaining((prev) => {
                    // If paused or user is active, don't decrement
                    if (isPaused || userActive) {
                        return prev
                    }

                    // If time's up, refresh and reset
                    if (prev <= 1) {
                        refreshPage()
                        return refreshInterval
                    }

                    // Otherwise decrement
                    return prev - 1
                })
            }, 1000)
        }

        startTimer()

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [refreshInterval, isPaused, userActive])

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset timer when interval changes
    useEffect(() => {
        setTimeRemaining(refreshInterval)
    }, [refreshInterval])

    const refreshPage = async () => {
        if (isRefreshing) return

        setIsRefreshing(true)

        try {
            // Log the refresh action
            await logAuditEvent({
                userId,
                action: "refresh",
                entityType: "page",
                entityId: pageName,
                details: { automatic: !isPaused, interval: refreshInterval },
            })

            // Refresh the page
            router.refresh()

            // Update last refreshed time
            setLastRefreshed(new Date())

            // Reset timer
            setTimeRemaining(refreshInterval)
        } catch (error) {
            console.error("Error refreshing page:", error)
        } finally {
            setIsRefreshing(false)
        }
    }

    const togglePause = () => {
        setIsPaused((prev) => !prev)
    }

    const handleIntervalChange = (value: string) => {
        const newInterval = Number.parseInt(value, 10)
        setRefreshInterval(newInterval)
        setTimeRemaining(newInterval)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* Auto-refresh control panel */}
            <Card className="mb-4 border-slate-200 bg-slate-50">
                <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={togglePause}
                            className="h-8 gap-1"
                            aria-label={isPaused ? "Resume auto-refresh" : "Pause auto-refresh"}
                        >
                            {isPaused ? (
                                <>
                                    <Play className="h-3.5 w-3.5" />
                                    <span>Resume</span>
                                </>
                            ) : (
                                <>
                                    <Pause className="h-3.5 w-3.5" />
                                    <span>Pause</span>
                                </>
                            )}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshPage}
                            disabled={isRefreshing}
                            className="h-8 gap-1"
                            aria-label="Refresh now"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            <span>Refresh Now</span>
                        </Button>

                        <div className="flex items-center gap-1 ml-2">
                            <span className="text-xs text-muted-foreground">Refresh every:</span>
                            <Select value={refreshInterval.toString()} onValueChange={handleIntervalChange}>
                                <SelectTrigger className="h-8 w-[90px]">
                                    <SelectValue placeholder="30s" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10s</SelectItem>
                                    <SelectItem value="30">30s</SelectItem>
                                    <SelectItem value="60">1m</SelectItem>
                                    <SelectItem value="300">5m</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {mounted && (
                            <div className="flex items-center">
                                <Clock className="h-3.5 w-3.5 mr-1" />
                                <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                            </div>
                        )}


                        {!isPaused && (
                            <div className="flex items-center gap-2">
                                <span>Next refresh in: {formatTime(timeRemaining)}</span>
                                <div className="w-24">
                                    <Progress
                                        value={(timeRemaining / refreshInterval) * 100}
                                        className="h-1.5"
                                        aria-label="Time until next refresh"
                                    />
                                </div>
                            </div>
                        )}

                        {isPaused && <span className="text-amber-600">Auto-refresh paused</span>}

                        {userActive && !isPaused && <span className="text-blue-600">Paused due to user activity</span>}
                    </div>
                </div>
            </Card>

            {/* Page content */}
            <div className={isRefreshing ? "opacity-70 transition-opacity duration-300" : ""}>{children}</div>
        </div>
    )
}
