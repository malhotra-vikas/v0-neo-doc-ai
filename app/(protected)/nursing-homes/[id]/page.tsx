import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageViewLogger } from "@/components/page-view-logger"
import { getServerUser } from "@/lib/server/auth"

export default async function NursingHomePage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  const resolvedParams = await params;
  // Log the params to debug

  const user = await getServerUser();  
  
  if (!user) {
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

  // Fetch files for this nursing home
  const { data: files } = await supabase.from("nursing_home_files").select("*").eq("nursing_home_id", resolvedParams.id)

  return (
    <div className="flex flex-col min-h-screen">
      <PageViewLogger
        user={user.user}
        pageName="Nursing Home Details"
        entityType="nursing_home"
        entityId={resolvedParams.id}
      />

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold">{nursingHome.name}</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Address</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{nursingHome.address || "No address provided"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{nursingHome.patients?.length || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Files</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{files?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="patients" className="mt-8">
          <TabsList>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="files">Monthly Files</TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Patients</CardTitle>
                <CardDescription>Patients registered at {nursingHome.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Patient list component would go here */}
                <p>Patient list component would be rendered here</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Files</CardTitle>
                <CardDescription>Files uploaded for {nursingHome.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* File management component would go here */}
                <p>File management component would be rendered here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
