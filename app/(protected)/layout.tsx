import { AuthGuard } from "@/components/auth-guard"
import DashboardHeader from "@/components/dashboard-header"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <DashboardHeader />
      <main className="container mx-auto py-6">
        {children}
      </main>
    </AuthGuard>
  )
}