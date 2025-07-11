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
  const resolvedParams = await params

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
    .eq("id", resolvedParams.id)
    .single()

  if (error || !nursingHome) {
    notFound()
  }

  return (
    <div className="flex flex-col min-h-screen">

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold">Patients for {nursingHome.name}</h1>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Patients</CardTitle>
              <CardDescription>Manage patients for {nursingHome.name}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PatientListClient patients={nursingHome.patients || []} nursingHomeId={resolvedParams.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
