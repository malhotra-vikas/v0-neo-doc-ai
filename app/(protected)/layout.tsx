import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import UserProviderWrapper from "@/contexts/UserProviderWrapper"
import { Footer } from "@/components/footer"

import { SpeedInsights } from "@vercel/speed-insights/next"

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

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role,facility_id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  return (
    <UserProviderWrapper 
      value={{
        user: session.user,
        userRole: userRole?.role,
        facilityId: userRole?.facility_id
      }}
    >
      <div className="min-h-screen flex flex-col bg-gray-50">
        <DashboardHeader />
        <main className="flex-1">
          {children}
        </main>
      </div>
      <Footer />
    </UserProviderWrapper>
  )
}