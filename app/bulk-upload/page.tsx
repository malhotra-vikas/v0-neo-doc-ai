import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { BulkFileUpload } from "@/components/bulk-file-upload"

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
        <p className="mb-6 text-gray-600">
          Upload patient files in bulk. The system will automatically extract patient information, create patient
          records if they don't exist, and associate the files with the correct patients.
        </p>

        <BulkFileUpload nursingHomes={nursingHomes || []} />
      </main>
    </div>
  )
}
