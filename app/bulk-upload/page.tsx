import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { BulkFileUpload } from "@/components/bulk-file-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function BulkUploadPage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Fetch nursing homes for the dropdown
  const { data: nursingHomes } = await supabase.from("nursing_homes").select("id, name")

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader user={session.user} />

      <main className="flex-1 container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Bulk Patient File Upload</h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>Understanding the bulk upload process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">File Naming</h3>
                <p className="text-sm text-muted-foreground">
                  Files should be named with the patient's name followed by the file type, e.g., "John Smith Patient
                  Engagement.pdf" or "Jane Doe 90 Day Unified.pdf"
                </p>
              </div>

              <div>
                <h3 className="font-medium">Patient Creation</h3>
                <p className="text-sm text-muted-foreground">
                  The system will automatically create patient records based on the filenames if they don't already
                  exist.
                </p>
              </div>

              <div>
                <h3 className="font-medium">File Types</h3>
                <p className="text-sm text-muted-foreground">
                  Files containing "Unified" in the name will be categorized as "90 Day Unified". All other files will
                  be categorized as "Patient Engagement".
                </p>
              </div>
            </CardContent>
          </Card>

          <BulkFileUpload nursingHomes={nursingHomes || []} />
        </div>
      </main>
    </div>
  )
}
