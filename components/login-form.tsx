"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2, AlertCircle } from "lucide-react"

// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"

export default function LoginForm() {
  const [email, setEmail] = useState("malhotra.vikas@gmail.com")
  const [password, setPassword] = useState("test@123")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Update the handleSubmit function to log login events
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      // Log successful login
      if (data.user) {
        logAuditEvent({
          user: data.user,
          actionType: "login",
          entityType: "user",
          entityId: data.user.id,
          details: { method: "password" },
        })
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-lg border-gray-200">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>
          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>
          <div className="flex justify-end mt-4">
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Forgot your password?
            </Link>
          </div>
          <Button type="submit" className="w-full text-white bg-primary-600 hover:bg-primary-700" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 border-t bg-gray-50 p-6 text-center text-sm text-gray-600 rounded-b-lg">
        <div className="flex items-center justify-center space-x-1">
          <span>Default credentials:</span>
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">malhotra.vikas@gmail.com / test@123</code>
        </div>
      </CardFooter>
    </Card>
  )
}
