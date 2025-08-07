"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Users } from "lucide-react"
import AddNursingHomeDialog from "./add-nursing-home-dialog"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

interface NursingHome {
  id: string
  name: string
  address: string
  logo_url?: string
  patients: any[]
}

interface NursingHomesListProps {
  nursingHomes: NursingHome[]
}

export default function NursingHomesList({ nursingHomes }: NursingHomesListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const fileInputsRef = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleLogoUpload = (homeId: string) => {
    fileInputsRef.current[homeId]?.click()
  }

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>, homeId: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    const supabase = createClientComponentClient()
    const { data: session } = await supabase.auth.getSession()
    console.log("Session", session)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `nursing-home-logos/${homeId}/${fileName}`

    console.log("Uploading to bucket: logos")
    console.log("File path:", filePath)
    console.log("File type:", file.type)

    const { data, error } = await supabase.storage
      .from("logos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type, // e.g., "image/png"
      })

    if (error) {
      console.error("❌ Error uploading logo:", error)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from("logos")
      .getPublicUrl(filePath)

    const publicUrl = publicUrlData?.publicUrl

    if (!publicUrl) {
      console.error("❌ Failed to get public URL")
      return
    }

    const { error: dbError } = await supabase
      .from("nursing_homes")
      .update({ logo_url: publicUrl })
      .eq("id", homeId)

    if (dbError) {
      console.error("❌ Failed to update logo_url in DB:", dbError.message)
    } else {
      console.log("✅ Logo uploaded and DB updated")
    }
  }

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
              <TableHead>Logo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Patients</TableHead>
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
                  <TableCell>
                    {home.logo_url ? (
                      <img
                        src={home.logo_url}
                        alt={`${home.name} logo`}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 italic text-xs">No logo</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{home.name}</TableCell>
                  <TableCell>{home.address}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      {home.patients?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogoUpload(home.id)}
                      >
                        Add Logo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadLogo(e, home.id)}
                        ref={(el) => (fileInputsRef.current[home.id] = el)}
                        style={{ display: "none" }}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/nursing-homes/${home.id}/patients`}>
                          Patients
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AddNursingHomeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </Card>
  )
}
