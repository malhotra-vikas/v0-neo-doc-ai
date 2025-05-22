import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft } from "lucide-react"
import { PageViewLogger } from "@/components/page-view-logger"

export default async function PatientPage({ params }: { params: { id: string } }) {
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
      <PageViewLogger user={session.user} pageName="Patient Details" entityType="patient" entityId={params.id} />

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold">{patient.name}</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Nursing Home</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{patient.nursing_homes?.name || "Unknown"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Medical Record #</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{patient.medical_record_number || "Not provided"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Date of Birth</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">
                {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : "Not provided"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="files" className="mt-8">
          <TabsList>
            <TabsTrigger value="files">Patient Files</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Patient Files</CardTitle>
                <CardDescription>Files uploaded for {patient.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Patient file management component would go here */}
                <p>Patient file management component would be rendered here</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Patient History</CardTitle>
                <CardDescription>Historical data for {patient.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Patient history component would go here */}
                <p>Patient history component would be rendered here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
