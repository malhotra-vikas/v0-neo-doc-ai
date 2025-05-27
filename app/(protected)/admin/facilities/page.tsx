import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { PageViewLogger } from "@/components/page-view-logger"
import { FacilitiesList } from "@/components/facilities-list"

export default async function FacilitiesPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()

  // Fetch facilities with user count
const { data: facilities, error } = await supabase
  .from('facilities')
  .select(`
    *,
    user_roles (
      id
    )
  `);
  return (
    <>
      <PageViewLogger user={session!.user} pageName="Facilities" />
      <main className="flex-1 container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Facilities Management</h1>
        <FacilitiesList facilities={facilities || []} />
      </main>
    </>
  )
}