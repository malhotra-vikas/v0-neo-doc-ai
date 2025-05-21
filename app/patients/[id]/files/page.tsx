import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import { PatientFilesTable } from "@/components/patient-files-table"

export default async function PatientFilesPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Fetch patient details
  const { data: patient, error } = await supabase
    .from("patients")
    .select("*, nursing_homes(*)")
    .eq("id", params.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  // Fetch files for this patient
  const { data: files } = await supabase.from("patient_files").select("*").eq("patient_id", params.id)

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader user={session.user} />

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href={`/patients/${params.id}`}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Patient
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Files for {patient.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Patient Files</CardTitle>
            <CardDescription>
              View and manage files for {patient.name} at {patient.nursing_homes?.name || "Unknown"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PatientFilesTable files={files || []} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
