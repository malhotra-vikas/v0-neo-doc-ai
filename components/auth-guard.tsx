"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FullPageLoader } from "./ui/full-page-loader"

const PUBLIC_PATHS = ['/login', '/forgot-password', '/callback']
const DEFAULT_AUTH_PATH = '/dashboard'
const DEFAULT_PUBLIC_PATH = '/login'

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, setIsNavigating] = useState(false)

    useEffect(() => {
        if (!loading) {
            const isPublicPath = PUBLIC_PATHS.includes(pathname)
            const isRootPath = pathname === '/'
            
            if (!user && !isPublicPath && pathname !== DEFAULT_PUBLIC_PATH) {
                setIsNavigating(true)
                router.replace(DEFAULT_PUBLIC_PATH)
            } else if (user && ((isPublicPath || isRootPath) && pathname !== DEFAULT_AUTH_PATH)) {
                setIsNavigating(true)
                router.replace(DEFAULT_AUTH_PATH)
            } else {
                setIsNavigating(false)
            }
        } else {
            setIsNavigating(loading && !user && pathname !== DEFAULT_PUBLIC_PATH)
        }
    }, [user, loading, pathname, router])

    if (loading || isNavigating) {
        return <FullPageLoader />
    }

    return <>{children}</>
}