import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardStats from "@/components/dashboard-stats"
import NursingHomesList from "@/components/nursing-homes-list"
import PatientsList from "@/components/patients-list"
import FileManagement from "@/components/file-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays } from "lucide-react"
import { Building, Users, Upload } from "lucide-react" // Import missing variables
import { PageViewLogger } from "@/components/page-view-logger"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

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

    // Fetch patients monthly files status
  const { data: patientsMonthlyFiles } = await supabase.from("patient_files").select("*")

  // Calculate statistics
  const totalNursingHomes = nursingHomes?.length || 0
  const totalPatients = nursingHomes?.reduce((acc, home) => acc + (home.patients?.length || 0), 0) || 0

  // Format current date
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex flex-col min-h-screen">
      <PageViewLogger user={session.user} pageName="Dashboard" />

      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {session.user.email?.split("@")[0] || "User"}</p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center text-sm text-gray-600">
            <CalendarDays className="mr-2 h-4 w-4 text-gray-500" />
            <span>{currentDate}</span>
          </div>
        </div>

        <DashboardStats
          nursingHomesCount={totalNursingHomes}
          patientsCount={totalPatients}
          monthlyFiles={monthlyFiles || []}
          patientMonthlyFiles={patientsMonthlyFiles || []}
        />

        <Card className="mt-8 border-t-4 border-t-primary-500">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-hover bg-primary-50 border-primary-100">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                    <Building className="h-6 w-6 text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Add Nursing Home</h3>
                  <p className="text-sm text-gray-600 mt-2">Register a new nursing home in the system</p>
                </CardContent>
              </Card>

              <Card className="card-hover bg-secondary-50 border-secondary-100">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-secondary-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Add Patient</h3>
                  <p className="text-sm text-gray-600 mt-2">Register a new patient to a nursing home</p>
                </CardContent>
              </Card>

              <Card className="card-hover bg-accent-50 border-accent-100">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6 text-accent-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Bulk Upload</h3>
                  <p className="text-sm text-gray-600 mt-2">Upload multiple patient files at once</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="nursing-homes" className="mt-8">
          <TabsList className="bg-gray-100 p-1">
            <TabsTrigger
              value="nursing-homes"
              className="data-[state=active]:bg-white data-[state=active]:text-primary-600"
            >
              Nursing Homes
            </TabsTrigger>
            <TabsTrigger value="patients" className="data-[state=active]:bg-white data-[state=active]:text-primary-600">
              Patients
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-white data-[state=active]:text-primary-600">
              Monthly Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nursing-homes" className="mt-6">
            <NursingHomesList nursingHomes={nursingHomes || []} />
          </TabsContent>

          <TabsContent value="patients" className="mt-6">
            <PatientsList nursingHomes={nursingHomes || []} />
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <FileManagement nursingHomes={nursingHomes || []} files={monthlyFiles || []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
