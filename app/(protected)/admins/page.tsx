import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { UsersList } from "@/components/users-list"
import { redirect } from "next/navigation"
import { UserRole } from "@/types/enums"
import { getServerUser } from "@/lib/server/auth"

export default async function AdminsPage() {
  
 const user = await getServerUser();
 
 if (!user) {
    redirect("/login")
  }
 
  if (user.role !== UserRole.SUPER_ADMIN) {
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