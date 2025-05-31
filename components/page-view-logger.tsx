"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { AuditEntityType, logAuditEvent } from "@/lib/audit-logger"
import { User } from "firebase/auth"

interface PageViewLoggerProps {
    user: User |  Omit<User,'toJSON'>
    pageName: string
    entityType?: AuditEntityType | "page"
    entityId?: string
}

export function PageViewLogger({ user, pageName, entityType, entityId }: PageViewLoggerProps) {
    const pathname = usePathname()

    useEffect(() => {
        // Log page view when component mounts
        logAuditEvent({
            user,
            actionType: "view",
            entityType: entityType || "page",
            entityId: entityId || pathname,
            details: { page: pageName, path: pathname },
        })
    }, [user, pageName, pathname, entityType, entityId])

    // This component doesn't render anything
    return null
}
