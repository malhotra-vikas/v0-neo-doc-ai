import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import DashboardStats from "@/components/dashboard-stats"
import NursingHomesList from "@/components/nursing-homes-list"
import PatientsList from "@/components/patients-list"
import FileManagement from "@/components/file-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Fetch nursing homes
  const { data: nursingHomes } = await supabase.from("nursing_homes").select("*, patients(*)")

  // Fetch monthly files status
  const { data: monthlyFiles } = await supabase.from("nursing_home_files").select("*")

  // Calculate statistics
  const totalNursingHomes = nursingHomes?.length || 0
  const totalPatients = nursingHomes?.reduce((acc, home) => acc + (home.patients?.length || 0), 0) || 0

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader user={session.user} />

      <main className="flex-1 container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <DashboardStats
          nursingHomesCount={totalNursingHomes}
          patientsCount={totalPatients}
          monthlyFiles={monthlyFiles || []}
        />

        <Tabs defaultValue="nursing-homes" className="mt-8">
          <TabsList>
            <TabsTrigger value="nursing-homes">Nursing Homes</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="files">Monthly Files</TabsTrigger>
          </TabsList>

          <TabsContent value="nursing-homes" className="mt-4">
            <NursingHomesList nursingHomes={nursingHomes || []} />
          </TabsContent>

          <TabsContent value="patients" className="mt-4">
            <PatientsList nursingHomes={nursingHomes || []} />
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <FileManagement nursingHomes={nursingHomes || []} files={monthlyFiles || []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
