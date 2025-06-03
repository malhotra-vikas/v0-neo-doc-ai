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
import { useToast } from "@/hooks/use-toast"
import { logger } from '@/lib/logger'
import { AuditActionType, UserStatus } from '@/types/enums'
import { AuthHero } from "@/components/auth-hero"
import { Logo } from "@/components/logo"
import { Suspense } from "react"
import { getAuth, applyActionCode, updatePassword, signInWithEmailAndPassword, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth'
import { app } from '@/config/firebase/firebase'

const COMPONENT = 'SetPasswordPage'

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

export default function CallbackPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackPage />
    </Suspense>
  )
}

function CallbackPage() {
  const auth = getAuth(app)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'verifyEmail' | 'resetPassword' | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const mode = searchParams.get('mode')
        const oobCode = searchParams.get('oobCode')
        
        if (!oobCode || !mode) {
          throw new Error('Invalid verification link')
        }

        if (mode === 'verifyEmail') {
          const continueUrl = searchParams.get('continueUrl')
          const urlParams = new URLSearchParams(new URL(continueUrl!).search)
          const emailParam = urlParams.get('email')
          if (emailParam) {
            setEmail(decodeURIComponent(decodeURIComponent(emailParam)))
          }
        } else if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth, oobCode)
          setEmail(email)
        }

        setMode(mode as 'verifyEmail' | 'resetPassword')
      } catch (error) {
        logger.error(COMPONENT, "Error validating access", error)
        setError('Invalid or expired link')
      }
    }

    validateAccess()
  }, [searchParams, auth])

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
      const oobCode = searchParams.get('oobCode')
      if (!oobCode) {
        throw new Error('Invalid verification code')
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords don't match")
      }

      const errors = validatePassword(password)
      if (errors.length > 0) {
        throw new Error(errors.join('\n'))
      }

       if (mode === 'resetPassword') {
      await confirmPasswordReset(auth, oobCode, password)
    } else {
      await applyActionCode(auth, oobCode)
      
      await signInWithEmailAndPassword(auth, email, 'password')
      const user = auth.currentUser
      if (!user) {
        throw new Error('User not found')
      }
      // Update user status in Supabase
      const { error: statusError } = await supabase
        .from('users')
        .update({ 
          status: UserStatus.ACTIVE,
          email_verified: true 
        })
        .eq('id', user.uid)
  
      if (statusError) throw statusError
      await updatePassword(user, password)
    }
      await auth.signOut()
      
      toast({
        variant: "default",
        title: "Success!",
        description: mode === 'verifyEmail' 
          ? "Email verified and password set successfully" 
          : "Password reset successfully"
      })

      router.push('/login')
    } catch (error: any) {
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

  if (error) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <Logo size="lg" />
            <Card>
              <CardContent className="p-6">
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full"
                  variant="outline"
                >
                  Back to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <Logo size="lg" />
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>
                  {mode === 'resetPassword' 
                      ? 'Reset Password' 
                      : 'Set Password'}
                </CardTitle>
                <CardDescription>
                 Create a strong password to secure your account
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {(
                    <>
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
                    </>
                  )}

                  <Button
                    type="submit"
                    className="w-full text-white bg-primary-600 hover:bg-primary-700"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        {mode === 'verifyEmail' 
                          ? 'Setting Password..' 
                          : 'Setting Password...'}
                      </>
                    ) : mode === 'verifyEmail'
                      ? 'Set Password'
                      : 'Reset Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
        <AuthHero />
      </div>
    </main>
  )
}