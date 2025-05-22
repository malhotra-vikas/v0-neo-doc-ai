"use client"

import type React from "react"

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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"

interface AddPatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nursingHomeId: string
}

export default function AddPatientDialog({ open, onOpenChange, nursingHomeId }: AddPatientDialogProps) {
  const [name, setName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [medicalRecordNumber, setMedicalRecordNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Update the handleSubmit function to log patient creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([
          {
            name,
            date_of_birth: dateOfBirth,
            medical_record_number: medicalRecordNumber,
            nursing_home_id: nursingHomeId,
          },
        ])
        .select()

      if (error) {
        throw error
      }

      // Log patient creation
      const user = await supabase.auth.getUser()
      if (user.data?.user && data && data[0]) {
        logAuditEvent({
          user: user.data.user,
          actionType: "create",
          entityType: "patient",
          entityId: data[0].id,
          details: {
            name,
            nursing_home_id: nursingHomeId,
            medical_record_number: medicalRecordNumber,
          },
        })
      }

      toast({
        title: "Success",
        description: "Patient added successfully",
      })

      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add patient",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Patient</DialogTitle>
          <DialogDescription>Enter the details of the new patient</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter patient name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mrn">Medical Record Number</Label>
            <Input
              id="mrn"
              value={medicalRecordNumber}
              onChange={(e) => setMedicalRecordNumber(e.target.value)}
              placeholder="Enter medical record number"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
