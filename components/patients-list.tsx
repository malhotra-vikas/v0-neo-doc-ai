"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AddPatientDialog from "./add-patient-dialog"
import { NursingHomeSelect } from "./nursing-home-select"

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
          <NursingHomeSelect
            nursingHomes={nursingHomes}
            value={selectedHomeId}
            onChange={(value) => setSelectedHomeId(value)}
            triggerClassName="w-[200px]"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
