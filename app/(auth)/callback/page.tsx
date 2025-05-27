'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { logger } from '@/lib/logger'

const COMPONENT = 'SetPasswordPage'

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

export default function CallbackPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValidAccess, setIsValidAccess] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const refreshToken = urlParams.get('refresh_token');
        if(refreshToken){
          await supabase.auth.refreshSession({ refresh_token: refreshToken });
        }
        const type = urlParams.get('type')
        if (!type || type !== 'invite') {
          logger.info(COMPONENT, "Invalid access attempt - missing parameters")
          router.replace('/login')
          return
        }

        setIsValidAccess(true)
        setLoading(false)
      } catch (error) {
        logger.error(COMPONENT, "Error validating access", error)
        router.replace('/login')
      }
    }

    validateAccess()
  }, [searchParams, router, supabase.auth])

  const validatePassword = (password: string): string[] => {
    try {
      passwordSchema.parse(password)
      return []
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors.map(err => err.message)
      }
      return ['Invalid password']
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords don't match")
      }
      const errors = validatePassword(password)
      if (errors.length > 0) {
        throw new Error(errors.join('\n'))
      }
      const urlParams = new URLSearchParams(window.location.hash.substring(1));
      const refreshToken = urlParams.get('refresh_token');
      if(refreshToken){
        await supabase.auth.refreshSession({ refresh_token: refreshToken });
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not found')

      const { error: statusError } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', user.id)

      if (statusError) throw statusError

      toast({
        title: "Password Set Successfully",
        description: "You can now login with your email and password",
      })

      router.push('/login')
    } catch (error: any) {
      logger.error(COMPONENT, "Error setting password", error)
      setError(error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // Show loading or redirect state
  if (!isValidAccess || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl mx-auto">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
              <p className="text-sm text-slate-600">
                {!isValidAccess ? "Validating access..." : "Loading..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Create a strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="whitespace-pre-line">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 hover:cursor-pointer transition-colors"
              disabled={loading}
            >
              {loading ? "Setting Password..." : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}