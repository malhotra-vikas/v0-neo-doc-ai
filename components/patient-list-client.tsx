"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText } from "lucide-react"

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
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
