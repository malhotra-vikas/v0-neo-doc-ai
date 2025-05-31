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
import { getAuth, applyActionCode, updatePassword, signInWithEmailAndPassword } from 'firebase/auth'
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
  const [isValidAccess, setIsValidAccess] = useState(false)
  const [type, setType] = useState('');
  const [email, setEmail] = useState('');

  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()


  useEffect(() => {
    const validateAccess = async () => {
      try {
        const emailVal = searchParams.get('email') ? decodeURIComponent(searchParams.get('email')!) : null
        const type = searchParams.get('type')
        if (!emailVal || !type) {
          logger.error(COMPONENT, "Missing parameters")
          throw new Error('Missing required parameters')
        }
        setEmail(emailVal)
        setType(type)
        setIsValidAccess(true)
        setLoading(false)
      } catch (error) {
        logger.error(COMPONENT, "Error validating access", error)
        router.replace('/login')
      }
    }

    validateAccess()
  }, [searchParams, router])

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
      const oobCode = searchParams.get('oobCode')
      if (oobCode) {
        await applyActionCode(auth, oobCode)
      }
      if (!email) {
        throw new Error('Email not found')
      }
      await signInWithEmailAndPassword(auth, email, 'password')
      const user = auth.currentUser
      if (!user) {
        throw new Error('User not found')
      }
      await updatePassword(user, password)

      const { error: statusError } = await supabase
        .from('users')
        .update({ status: UserStatus.ACTIVE })
        .eq('id', user.uid)

      if (statusError) throw statusError

      toast({
        variant: "default",
        title: "Password Set Successfully",
        description: "You can now login with your email and password",
      })
      await auth.signOut()
      router.push('/login')

    } catch (error: any) {
      logger.error(COMPONENT, "Password update error", error)
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

  if (!isValidAccess || loading) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="flex-1 flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
            <div className="w-full max-w-md">
              <Logo size="lg" />
              <Card className="mt-8">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    <p className="text-sm text-gray-600">
                      {!isValidAccess ? "Validating access..." : "Loading..."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <AuthHero />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <Logo size="lg" />
              <h1 className="mt-6 text-3xl font-bold text-gray-900">{type == AuditActionType.INVITE ? 'Set Your Password' : 'Reset Your Password'}</h1>
              <p className="mt-2 text-gray-600">
                Create a strong password to secure your account
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
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
                    className="w-full text-white bg-primary-600 hover:bg-primary-700"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Setting Password...
                      </>
                    ) :
                      type == AuditActionType.INVITE ? 'Set Password' : 'Reset Password'
                    }
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