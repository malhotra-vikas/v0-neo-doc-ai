"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/auth-helpers-nextjs"
import { logAuditEvent } from "@/lib/audit-logger"

interface PageViewLoggerProps {
    user: User
    pageName: string
    entityType?: string
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
