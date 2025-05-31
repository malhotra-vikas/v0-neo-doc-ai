import { getServerUser } from '@/lib/server/auth'
import { redirect } from 'next/navigation'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerUser()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
}