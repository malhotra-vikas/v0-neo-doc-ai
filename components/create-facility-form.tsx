"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Upload, Building2, ImagePlus, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import { logger } from "@/lib/logger"
import { logAuditEvent } from "@/lib/audit-logger"

const COMPONENT = "CreateFacilityForm"

interface CreateFacilityFormProps {
   onSuccess?: () => void  
}

export function CreateFacilityForm({ onSuccess }: CreateFacilityFormProps) {
  // Move useState declarations inside useEffect to avoid hydration mismatch
  const [state, setState] = useState({
    name: "",
    logo: null as File | null,
    logoPreview: "",
    loading: false,
    error: null as string | null
  })

  // Use useEffect to handle initial client-side setup
  useEffect(() => {
    logger.debug(COMPONENT, "Component mounted", {
      hasLogo: !!state.logo,
      name: state.name
    })
  }, [state.logo, state.name])

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Logo file must be less than 5MB",
          variant: "destructive"
        })
        return
      }

      setState(prev => ({ ...prev, logo: file }))
      const reader = new FileReader()
      reader.onloadend = () => {
        setState(prev => ({ 
          ...prev, 
          logoPreview: reader.result as string 
        }))
      }
      reader.readAsDataURL(file)

      logger.info(COMPONENT, "Logo selected", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, loading: true, error: null }))

    const timer = logger.timing(COMPONENT, "create-facility")
    logger.info(COMPONENT, "Creating facility", { name: state.name })

    const user = await supabase.auth.getUser()
      if (user) {
          logger.info(COMPONENT, "Creating facility",JSON.stringify({ name: state.name, user: user.data.user }))
      }
    try {
      // Upload logo if selected
      let logoUrl = null
      if (state.logo) {
        logger.debug(COMPONENT, "Uploading logo")
        const fileExt = state.logo.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${state.name}/${fileName}`

        // console.log("User:", user.data.user)

        const { error: uploadError } = await supabase.storage
          .from('facility-logos')
          .upload(filePath, state.logo)

        if (uploadError) throw uploadError

        logoUrl = filePath

        logger.info(COMPONENT, "Logo uploaded successfully", { filePath })
      }

      // Create facility
      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .insert([
          {
            name: state.name,
            logo_url: logoUrl,
            created_by: (await supabase.auth.getUser()).data.user?.id
          }
        ])
        .select()
        .single()

      if (facilityError) throw facilityError

      // Log facility creation
      const user = await supabase.auth.getUser()
      if (user.data?.user && facility) {
        logAuditEvent({
          user: user.data.user,
          actionType: "create",
          entityType: "facility",
          entityId: facility.id,
          details: {
            name: state.name,
            has_logo: !!logoUrl
          }
        })
      }

      const processingTime = timer.end()
      logger.info(COMPONENT, "Facility created successfully", {
        facilityId: facility.id,
        processingTime
      })
     onSuccess?.()
      toast({
        title: "Facility Created",
        description: "The facility has been created successfully.",
        variant: "default"
      })

      router.push('/admin/facilities')
      router.refresh()
    } catch (error: any) {
      logger.error(COMPONENT, "Error creating facility", error)
      setState(prev => ({ ...prev, error: error.message }))
      toast({
        title: "Error",
        description: "Failed to create facility. Please try again.",
        variant: "destructive"
      })
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-md border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <CardTitle className="text-xl text-slate-800 flex items-center">
          <Building2 className="mr-2 h-5 w-5 text-primary" />
          Create New Facility
        </CardTitle>
        <CardDescription>
          Add a new healthcare facility to the system
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Facility Name</Label>
            <Input
              id="name"
              value={state.name}
              onChange={(e) => setState(prev => ({ 
                ...prev, 
                name: e.target.value 
              }))}
              placeholder="Enter facility name"
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Facility Logo</Label>
            <div className="flex items-center space-x-4">
              {state.logoPreview && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <Image
                    src={state.logoPreview}
                    alt="Logo preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImagePlus className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Click to upload logo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                  </div>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 hover:cursor-pointer transition-colors"
            disabled={state.loading || !state.name}
          >
            {state.loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Facility...
              </>
            ) : (
              <>
                Create Facility
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="bg-slate-50 border-t px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Created facilities will be available for user assignment and document management.
        </p>
      </CardFooter>
    </Card>
  )
}