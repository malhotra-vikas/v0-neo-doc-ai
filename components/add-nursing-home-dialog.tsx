"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Building2, MapPin, Phone, Mail, Globe, X, Loader2, CheckCircle } from "lucide-react"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"
import { useAuth } from "./providers/auth-provider"

interface AddNursingHomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const nursingHomeSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(100),
  address: z.string().min(5, { message: "Address must be at least 5 characters" }).max(200),
  city: z.string().min(2, { message: "City is required" }).max(100),
  state: z.string().min(2, { message: "State is required" }).max(50),
  zipCode: z.string().min(5, { message: "ZIP code is required" }).max(10),
  phone: z.string().min(10, { message: "Phone number is required" }).max(20).optional(),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  website: z.string().url({ message: "Invalid website URL" }).optional().or(z.literal("")),
})

type NursingHomeFormValues = z.infer<typeof nursingHomeSchema>

export default function AddNursingHomeDialog({ open, onOpenChange }: AddNursingHomeDialogProps) {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const { facilityId,user } = useAuth()

  const form = useForm<NursingHomeFormValues>({
    resolver: zodResolver(nursingHomeSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      email: "",
      website: "",
    },
  })

  // Update the onSubmit function to log nursing home creation
  const onSubmit = async (values: NursingHomeFormValues) => {
    setFormState("submitting")

    try {
      // Format the address for the database
      const formattedAddress = `${values.address}, ${values.city}, ${values.state} ${values.zipCode}`

      const { data, error } = await supabase
        .from("nursing_homes")
        .insert([
          {
            name: values.name,
            address: formattedAddress,
            // phone: values.phone || null,
            // email: values.email || null,
            // website: values.website || null,
            facility_id: facilityId,
          },
        ])
        .select()

      if (error) {
        throw error
      }

      // Log nursing home creation
      if (user && data && data[0]) {
        logAuditEvent({
          user: user,
          actionType: "create",
          entityType: "nursing_home",
          entityId: data[0].id,
          details: {
            name: values.name,
            address: formattedAddress,
          },
        })
      }

      setFormState("success")

      toast({
        title: "Success",
        description: "Nursing home added successfully",
        variant: "success",
      })

      // Wait a moment to show success state before closing
      setTimeout(() => {
        form.reset()
        onOpenChange(false)
        router.refresh()
      }, 1500)
    } catch (error: any) {
      setFormState("error")

      toast({
        title: "Error",
        description: error.message || "Failed to add nursing home",
        variant: "destructive",
      })

      // Reset form state after a delay
      setTimeout(() => {
        setFormState("idle")
      }, 2000)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          // Reset form when dialog is closed
          form.reset()
          setFormState("idle")
        }
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Add Nursing Home</DialogTitle>
                <DialogDescription className="mt-1">
                  Enter the details of the new nursing home facility
                </DialogDescription>
              </div>
            </div>
            <DialogClose className="h-8 w-8 rounded-full hover:bg-slate-200 flex items-center justify-center">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Enter facility name" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="123 Main St" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="ZIP Code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="(555) 123-4567" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="contact@facility.com" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="https://www.facility.com" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formState === "submitting" || formState === "success"}
                className="min-w-[120px]"
              >
                {formState === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : formState === "success" ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Added
                  </>
                ) : (
                  "Add Nursing Home"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
