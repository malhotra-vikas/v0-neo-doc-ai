"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Trash2 } from "lucide-react"

interface Patient {
  id: string
  name: string
  medical_record_number: string
  date_of_birth: string
}

interface PatientListClientProps {
  patients: Patient[]
  nursingHomeId: string
}

export function PatientListClient({ patients, nursingHomeId }: PatientListClientProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this patient?")) return

    try {
      setDeletingId(id)
      const res = await fetch(`/api/patients/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("Failed to delete patient")
      }
      // Option 1: reload page
      window.location.reload()
      // Option 2: if you want to optimistically remove from state, 
      // lift patients into state and filter here instead of reload
    } catch (err) {
      console.error(err)
      alert("Error deleting patient")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Medical Record #</TableHead>
          <TableHead>Date of Birth</TableHead>
          <TableHead>Files</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center">
              No patients found for this nursing home
            </TableCell>
          </TableRow>
        ) : (
          patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">{patient.name}</TableCell>
              <TableCell>{patient.medical_record_number}</TableCell>
              <TableCell>{new Date(patient.date_of_birth).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />0
                </div>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/patients/${patient.id}`}>View Details</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/patients/${patient.id}/files`}>Manage Files</Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(patient.id)}
                    disabled={deletingId === patient.id}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {deletingId === patient.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
