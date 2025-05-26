import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { DebugSupabase } from "@/components/debug-supabase"

export default async function DebugPage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold">Debug & Troubleshooting</h1>
        </div>

        <div className="grid gap-6">
          <DebugSupabase />
        </div>
      </main>
    </div>
  )
}
