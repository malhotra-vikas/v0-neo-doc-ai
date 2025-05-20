"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users, FileText } from "lucide-react"
import AddNursingHomeDialog from "./add-nursing-home-dialog"

interface NursingHome {
  id: string
  name: string
  address: string
  patients: any[]
}

interface NursingHomesListProps {
  nursingHomes: NursingHome[]
}

export default function NursingHomesList({ nursingHomes }: NursingHomesListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Nursing Homes</CardTitle>
          <CardDescription>Manage your nursing homes and their patients</CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Nursing Home
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Patients</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nursingHomes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No nursing homes found. Add your first one!
                </TableCell>
              </TableRow>
            ) : (
              nursingHomes.map((home) => (
                <TableRow key={home.id}>
                  <TableCell className="font-medium">{home.name}</TableCell>
                  <TableCell>{home.address}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      {home.patients?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />0
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/nursing-homes/${home.id}`}>View Details</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/nursing-homes/${home.id}/patients`}>Patients</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AddNursingHomeDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </Card>
  )
}
