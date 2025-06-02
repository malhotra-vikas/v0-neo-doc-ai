"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Building2, Users, Loader2 } from "lucide-react"
import { CreateFacilityForm } from "./create-facility-form"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog"
import { Switch } from "./ui/switch"
import { getClientDatabase } from "@/lib/services/supabase"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "./providers/auth-provider"

interface Facility {
  id: string
  name: string
  logo_url?: string
  created_at: string
  user_roles?: { id: string }[]
  is_active?: boolean
}

export function FacilitiesList() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()
  const db = getClientDatabase()
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchFacilities = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.getFacilities()      
      if (error) throw error
      
      setFacilities(data || [])
    } catch (error) {
      console.error('Error fetching facilities:', error)
      toast({
        title: "Error",
        description: "Failed to load facilities. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFacilities()
  }, []) 

  const handleStatusToggle = async (facilityId: string, isActive: boolean) => {
    try {
      setActionLoading(facilityId)
      const { error } = await db.updateFacilityStatus(facilityId, isActive, user?.uid ?? '')
      if (error) throw error
      
      // Fetch fresh data instead of updating state
      await fetchFacilities()

      toast({
        title: "Status Updated",
        description: `Facility has been ${isActive ? 'activated' : 'deactivated'} successfully.`,
        variant: "default",
      })
    } catch (error) {
      console.error('Error updating facility status:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update facility status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Facilities</CardTitle>
          <CardDescription>Manage healthcare facilities and their users</CardDescription>
        </div>
        <Button onClick={() => { setIsDialogOpen(true); setSelectedFacility(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Facility
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow 
                  key={facility.id}
                  className={actionLoading === facility.id ? 'opacity-50' : ''}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>{facility.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      {Array.isArray(facility?.user_roles) ? facility?.user_roles.length : 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(facility.created_at).toLocaleDateString('en-GB')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm"  onClick={() => {
                          setSelectedFacility(facility)
                          setIsDialogOpen(true)
                        }}>
                       View Details
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/facilities/${facility.id}/users`}>Users</Link>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <Switch
                        checked={facility.is_active ?? false}
                        onCheckedChange={(checked) =>
                          handleStatusToggle(facility.id, checked)
                        }
                        disabled={actionLoading === facility.id}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-200"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedFacility ? 'Edit Facility' : 'Create New Facility'}
            </DialogTitle>
            <DialogDescription>
              {selectedFacility 
                ? 'Update facility information'
                : 'Add a new healthcare facility to the system'}
            </DialogDescription>
          </DialogHeader>
          <CreateFacilityForm 
            facility={selectedFacility || undefined}
            onSuccess={async () => {
              await fetchFacilities() 
              setIsDialogOpen(false)
              setSelectedFacility(null)
            }} 
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}