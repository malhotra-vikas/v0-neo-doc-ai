"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, FileText } from "lucide-react"
import AddPatientDialog from "./add-patient-dialog"

interface Patient {
  id: string
  name: string
  nursing_home_id: string
  date_of_birth: string
  medical_record_number: string
}

interface NursingHome {
  id: string
  name: string
  patients: Patient[]
}

interface PatientsListProps {
  nursingHomes: NursingHome[]
}

export default function PatientsList({ nursingHomes }: PatientsListProps) {
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(
    nursingHomes.length > 0 ? nursingHomes[0].id : null,
  )
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const selectedHome = nursingHomes.find((home) => home.id === selectedHomeId)
  const patients = selectedHome?.patients || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Patients</CardTitle>
          <CardDescription>Manage patients across nursing homes</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedHomeId || ""} onValueChange={(value) => setSelectedHomeId(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select nursing home" />
            </SelectTrigger>
            <SelectContent>
              {nursingHomes.map((home) => (
                <SelectItem key={home.id} value={home.id}>
                  {home.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
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
            {!selectedHomeId ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Please select a nursing home
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
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
      </CardContent>

      {selectedHomeId && (
        <AddPatientDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} nursingHomeId={selectedHomeId} />
      )}
    </Card>
  )
}
