import { AuthProvider } from "@/components/providers/auth-provider"
import DashboardHeader from "@/components/dashboard-header"
import { Footer } from "@/components/footer"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <DashboardHeader />
        <main className="flex-1">{children}</main>
      </div>
      <Footer />
    </AuthProvider>
  )
}