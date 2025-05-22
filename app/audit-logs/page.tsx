import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { AuditLogViewer } from "@/components/audit-log-viewer"

export default async function AuditLogsPage() {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // Fetch initial audit logs (most recent 50)
    const { data: auditLogs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

    // Fetch users for filtering
    const { data: users } = await supabase
        .from("audit_logs")
        .select("user_id, user_email")
        .order("user_email")
        .limit(100)
        .then((result) => {
            // Deduplicate users
            if (result.data) {
                const uniqueUsers = Array.from(new Map(result.data.map((item) => [item.user_id, item])).values())
                return { data: uniqueUsers }
            }
            return result
        })

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>
                <AuditLogViewer initialLogs={auditLogs || []} users={users || []} currentUser={session.user} />
            </main>
        </div>
    )
}
