import { redirect } from "next/navigation"
import { DebugSupabase } from "@/components/debug-supabase"
import { getServerUser } from "@/lib/server/auth"

export default async function DebugPage() {
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
