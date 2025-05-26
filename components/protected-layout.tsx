import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { cookies } from "next/headers"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }
  
  // Get user role
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id) 
    .single()
  

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader user={session.user} userRole={userRole?.role} />
      {children}
    </div>
  )
}