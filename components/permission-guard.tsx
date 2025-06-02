import { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"

interface PermissionGuardProps {
  children: ReactNode
  resource: string
  action: string
  fallback?: ReactNode
}

export function PermissionGuard({
  children,
  resource,
  action,
  fallback = null
}: PermissionGuardProps) {
  const { hasPermission, loading } = usePermissions()

  if (loading) return null
  if (!hasPermission(resource, action)) return fallback

  return <>{children}</>
}