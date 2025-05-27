import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Get user role from database
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role,facility_id')
    .eq('user_id', session.user.id)
    .single()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DashboardHeader 
        user={session.user} 
        userRole={userRole?.role}
        facilityId={userRole?.facility_id}
      />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}