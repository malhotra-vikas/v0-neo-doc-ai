"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function DebugSupabase() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [bucketExists, setBucketExists] = useState<boolean | null>(null)
  const [bucketPublic, setBucketPublic] = useState<boolean | null>(null)
  const supabase = createClientComponentClient()

  const checkSupabaseConnection = async () => {
    try {
      setError(null)
      setSuccess(null)

      // Test database connection
      const { data, error } = await supabase.from("nursing_homes").select("count()", { count: "exact" })

      if (error) throw error

      setSuccess(`Successfully connected to Supabase. Found ${data.length} nursing homes.`)

      // Check storage bucket
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()

      if (bucketError) throw bucketError

      const nursingHomeBucket = buckets.find((b) => b.name === "nursing-home-files")

      if (nursingHomeBucket) {
        setBucketExists(true)
        setBucketPublic(nursingHomeBucket.public || false)
      } else {
        setBucketExists(false)
        throw new Error("The 'nursing-home-files' storage bucket doesn't exist")
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to Supabase")
      console.error("Supabase connection error:", err)
    }
  }

  const createBucket = async () => {
    try {
      setError(null)
      const { data, error } = await supabase.storage.createBucket("nursing-home-files", {
        public: true,
      })

      if (error) throw error

      setBucketExists(true)
      setBucketPublic(true)
      setSuccess("Storage bucket 'nursing-home-files' created successfully")
    } catch (err: any) {
      setError(err.message || "Failed to create bucket")
      console.error("Create bucket error:", err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supabase Connection Diagnostics</CardTitle>
        <CardDescription>Test your Supabase connection and storage configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {bucketExists !== null && (
          <div className="grid gap-2">
            <p>
              <strong>Storage Bucket:</strong> {bucketExists ? "Exists" : "Missing"}
            </p>
            {bucketExists && (
              <p>
                <strong>Public Access:</strong> {bucketPublic ? "Enabled" : "Disabled"}
              </p>
            )}

            {!bucketExists && (
              <Button onClick={createBucket} className="mt-2">
                Create 'nursing-home-files' Bucket
              </Button>
            )}
          </div>
        )}

        <Button onClick={checkSupabaseConnection}>Test Supabase Connection</Button>
      </CardContent>
    </Card>
  )
}
