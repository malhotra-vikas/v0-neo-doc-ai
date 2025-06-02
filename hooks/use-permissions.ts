import { useAuth } from "@/components/providers/auth-provider"
import { getClientDatabase } from "@/lib/services/supabase"
import { useEffect, useState } from "react"

export function usePermissions() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Array<{resource: string, action: string}>>([])
  const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchPermissions = async () => {
    if (!user) {
      setPermissions([])
      setLoading(false)
      return
    }

    try {
      const db = getClientDatabase()
      const { data, error } = await db.getUserRolePermissions(user.uid)
      
      if (error) throw error
      
      setPermissions(data?.flatMap(p => p.permissions) || [])
    } catch (error) {
      console.error('Error fetching permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  fetchPermissions()
}, [user])

  const hasPermission = (resource: string, action: string) => {
    return permissions.some(p => 
      p.resource === resource && p.action === action
    )
  }

  return { permissions, hasPermission, loading }
}