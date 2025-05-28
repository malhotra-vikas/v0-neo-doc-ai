"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { inviteUser } from "@/app/actions/invite-user"
import { UserRole } from "@/types/enums"
import { getClientDatabase } from "@/lib/services/supabase"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUser } from "@/components/providers/user-provider"

const COMPONENT = "CreateUserForm"

const emailSchema = z.string().email("Please enter a valid email address")

interface CreateUserFormProps {
  facilityId?: string
  onSuccess: () => void
  role?:UserRole
  isInsertSuperAdmin?:boolean
}

export function CreateUserForm({ facilityId, onSuccess, role,isInsertSuperAdmin }: CreateUserFormProps) {
  const [email, setEmail] = useState("")
  const [selectedRole, setSelectedRole] = useState<UserRole>(role || UserRole.FACILITY_USER)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const db = getClientDatabase()
  const { userRole } = useUser()
  
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN

  const validateEmail = (email: string) => {
    try {
      emailSchema.parse(email)
      return true
    } catch (error) {
      return false
    }
  }

 const checkExistingUser = async (email: string) => {
  try {
    const { data: userData, error: userError } = await db.getUserByEmail(email) 
    if (userError) throw userError;

    return !!userData; 
  } catch (error) {
    logger.error("checkExistingUser", "Error checking existing user", error);
    return false;
  }
}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address")
      }

      logger.info(COMPONENT, "Checking for existing user", { email })

      const exists = await checkExistingUser(email)
      if (exists) {
        throw ("A user with this email already exists")
      }

      await inviteUser(email, facilityId, isInsertSuperAdmin ?UserRole.SUPER_ADMIN :( isSuperAdmin ? selectedRole : role))

      toast({
         variant: "default",
        title: "Success",
        description: "User has been invited successfully.",
      })

      onSuccess()
    } catch (error: any) {
      setError(error && typeof(error) == "string" ? error : "Failed to invite user. Please try again.")
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to invite user. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    
    if (newEmail && !validateEmail(newEmail)) {
      setError("Please enter a valid email address")
    } else {
      setError(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Enter user's email"
          required
          className={`w-full ${error ? 'border-red-500' : ''}`}
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>

      {isSuperAdmin && !isInsertSuperAdmin && (
        <div className="space-y-2">
          <Label htmlFor="role">User Role</Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as UserRole)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UserRole.FACILITY_ADMIN}>
                Facility Admin
              </SelectItem>
              <SelectItem value={UserRole.FACILITY_USER}>
                Facility User
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 hover:cursor-pointer transition-colors"
        disabled={loading || !email}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Inviting User...
          </>
        ) : (
          "Invite User"
        )}
      </Button>
    </form>
  )
}