import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { UsersList } from "@/components/users-list"

export default async function FacilityUsersPage({
    params,
}: {
    params: { id: string }
}) {
  const facilityId = params.id;
  const supabase = createServerComponentClient({ cookies })

  // Get facility details
  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .single()

  if (!facility) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6">
      <UsersList 
        facilityId={facilityId}
        facilityName={facility.name}
      />
    </div>
  )
}