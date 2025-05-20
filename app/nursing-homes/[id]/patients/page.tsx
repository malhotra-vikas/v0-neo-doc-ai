import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, Plus } from "lucide-react"
import { PatientListClient } from "@/components/patient-list-client"

export default async function NursingHomePatientsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Fetch nursing home details
  const { data: nursingHome, error } = await supabase
    .from("nursing_homes")
    .select("*, patients(*)")
    .eq("id", params.id)
    .single()

  if (error || !nursingHome) {
    notFound()
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader user={session.user} />

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href={`/nursing-homes/${params.id}`}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Nursing Home
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Patients for {nursingHome.name}</h1>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Patients</CardTitle>
              <CardDescription>Manage patients for {nursingHome.name}</CardDescription>
            </div>
            <Link href={`/nursing-homes/${params.id}/add-patient`} passHref>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Patient
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <PatientListClient patients={nursingHome.patients || []} nursingHomeId={params.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
