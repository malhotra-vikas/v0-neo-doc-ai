import { useAuth } from "./providers/auth-provider"
import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: Array<{resource: string, action: string}>
}

export function ProtectedRoute({ 
  children, 
  requiredPermissions = [] 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    if (!permissionsLoading && requiredPermissions.length > 0) {
      const hasAccess = requiredPermissions.every(({ resource, action }) => 
        hasPermission(resource, action)
      )

      if (!hasAccess) {
        router.push('/unauthorized')
      }
    }
  }, [user, authLoading, permissionsLoading, requiredPermissions, router])

  if (authLoading || permissionsLoading) {
    return <div>Loading...</div>
  }

  return <>{children}</>
}