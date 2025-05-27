"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { inviteUser } from "@/app/actions/invite-user"

const COMPONENT = "CreateUserForm"

const emailSchema = z.string().email("Please enter a valid email address")

interface CreateUserFormProps {
  facilityId: string
  onSuccess: () => void
}

export function CreateUserForm({ facilityId, onSuccess }: CreateUserFormProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClientComponentClient()

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
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

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
        throw new Error("A user with this email already exists")
      }

      await inviteUser(email, facilityId)

      toast({
        title: "Success",
        description: "User has been invited successfully.",
      })

      onSuccess()
    } catch (error: any) {
      logger.error(COMPONENT, "Error inviting user", { error: error.message })
      setError(error.message)
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