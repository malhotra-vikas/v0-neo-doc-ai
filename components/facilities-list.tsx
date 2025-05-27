"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Building2, Users } from "lucide-react"
import { CreateFacilityForm } from "./create-facility-form"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog"

interface Facility {
  id: string
  name: string
  logo_url?: string
  created_at: string
  users_count?: { count: number }[]
}

interface FacilitiesListProps {
  facilities: Facility[]
}

export function FacilitiesList({ facilities }: FacilitiesListProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Facilities</CardTitle>
          <CardDescription>Manage healthcare facilities and their users</CardDescription>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Facility
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facilities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No facilities found. Add your first one!
                </TableCell>
              </TableRow>
            ) : (
              facilities.map((facility) => (
                <TableRow key={facility.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>{facility.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      { facility?.users_count ? facility?.users_count[0].count : 0}
                    </div>
                  </TableCell>
                  <TableCell>
                   {new Date(facility.created_at).toLocaleDateString('en-GB')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/facilities/${facility.id}`}>View Details</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/facilities/${facility.id}/users`}>Users</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
           <DialogHeader>
            <DialogTitle>Create New Facility</DialogTitle>
            <DialogDescription>Add a new healthcare facility to the system</DialogDescription>
          </DialogHeader>
          <CreateFacilityForm onSuccess={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}