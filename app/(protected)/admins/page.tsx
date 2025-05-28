import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { UsersList } from "@/components/users-list"
import { redirect } from "next/navigation"
import { UserRole } from "@/types/enums"

export default async function AdminsPage() {
  const supabase = createServerComponentClient({ cookies })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }
  console.log("AdminsPage session",  session.user.id)

  // Get current user's role
  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single()

  if (currentUserRole?.role !== UserRole.SUPER_ADMIN) {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-6">
      <UsersList 
        isSuperAdminView={true}
      />
    </div>
  )
}