"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ImagePlus, Loader2 } from "lucide-react"
import Image from "next/image"
import { logger } from "@/lib/logger"
import { logAuditEvent } from "@/lib/audit-logger"
import { useAuth } from "./providers/auth-provider"
import { Timer } from "@/lib/timer"
import { StorageService } from "@/lib/services/supabase/storage"
import { getClientDatabase } from "@/lib/services/supabase"

const COMPONENT = "CreateFacilityForm"

interface Facility {
  id: string
  name: string
  logo_url?: string
}

interface CreateFacilityFormProps {
  onSuccess?: () => void
  facility?: Facility
}

export function CreateFacilityForm({ onSuccess, facility }: CreateFacilityFormProps) {
  const [state, setState] = useState({
    name: facility?.name || "",
    logo: null as File | null,
    logoPreview: facility?.logo_url || "",
    loading: false,
    error: null as string | null
  })
  const storageService = new StorageService()

  useEffect(() => {
    logger.debug(COMPONENT, "Component mounted", {
      hasLogo: !!state.logo,
      name: state.name
    })
  }, [state.logo, state.name])

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const db = getClientDatabase();

  useEffect(() => {
    const loadFacilityLogo = async () => {
      if (facility?.logo_url) {
        try {
          const logoUrl = await storageService.getFacilityLogoUrl(facility.logo_url)
          if (logoUrl) {
            setState(prev => ({ ...prev, logoPreview: logoUrl }))
          }
        } catch (error) {
          logger.error(COMPONENT, "Error loading facility logo", { error })
        }
      }
    }

    loadFacilityLogo()
  }, [facility?.logo_url])


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
    try {
      // Check if facility name exists
      const exists = await db.checkFacilityNameExists(state.name, facility?.id)
      if (exists) {
        throw new Error('A facility with this name already exists')
      }

      // Handle logo upload if needed
      let logoUrl:string = facility?.logo_url ?? ''
      if (state.logo) {
        const fileExt = state.logo.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${state.name}/${fileName}`
        logoUrl = filePath;
        await storageService.uploadFacilityLogo(filePath,state.logo )
      }

      // Create or update facility
      if (facility) {
        const { data, error } = await db.updateFacility(facility.id, {
          name: state.name,
          logo_url: logoUrl,
          updated_by: user?.uid ?? ''
        })
        
        if (error) throw error

        toast({
          title: "Success!",
          description: "The facility has been updated successfully."
        })
      } else {
        const { data, error } = await db.createFacility({
          name: state.name,
          logo_url: logoUrl,
          created_by: user?.uid ?? ''
        })

        if (error) throw error

        if (user && data) {
          logAuditEvent({
            user,
            actionType: "create",
            entityType: "facility",
            entityId: data.id,
            details: { name: state.name, has_logo: !!logoUrl }
          })
        }

        toast({
          title: "Success!",
          description: "The facility has been created successfully.",
          variant: "success"
        })
      }

      onSuccess?.()
      router.refresh()
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }))
      toast({
        title: "Error",
        description: error.message ?? "Failed to process facility. Please try again.",
        variant: "destructive"
      })
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-md border-slate-200">
      <CardContent className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Show logo section for both create and edit */}
          <div className="space-y-2">
            <Label htmlFor="logo">Facility Logo</Label>
            <div className="flex items-center space-x-4">
              {(state.logoPreview || facility?.logo_url) && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <Image
                    src={state.logoPreview || facility?.logo_url || ''}
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
                    <p className="text-sm text-gray-500">Click to {facility ? 'change' : 'upload'} logo</p>
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
                {facility ? "Updating Facility..." : "Creating Facility..."}
              </>
            ) : (
              <>{facility ? "Update Facility" : "Create Facility"}</>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="bg-slate-50 border-t px-6 py-4">
        <p className="text-xs text-muted-foreground">
          {facility
            ? "Update facility information to manage access and documentation."
            : "Created facilities will be available for user assignment and document management."
          }
        </p>
      </CardFooter>
    </Card>
  )
}