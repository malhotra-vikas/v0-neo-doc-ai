"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { initiatePasswordReset } from "@/app/actions/reset-password"
import { z } from "zod"

const emailSchema = z.string().email("Please enter a valid email address")


export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

    const validateEmail = (email: string) => {
    try {
      emailSchema.parse(email)
      return true
    } catch (error) {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    try {
      const result = await initiatePasswordReset(email)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Reset link sent",
        description: result.message,
      })
      
      setEmail("") 
    } catch (error: any) {
      setError(error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset link",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null) 
          }}
          required
          disabled={loading}
          className={error ? "border-red-500" : ""}
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
      <Button 
        type="submit" 
        className="w-full text-white bg-primary-600 hover:bg-primary-700" 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Reset Link...
          </>
        ) : (
          "Send Reset Link"
        )}
      </Button>
    </form>
  )
}