import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { ReportGenerator } from "@/components/report-generator"

export default async function ReportsPage() {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // Fetch nursing homes for the dropdown
    const { data: nursingHomes } = await supabase.from("nursing_homes").select("id, name")

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader user={session.user} />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Reports</h1>
                <ReportGenerator nursingHomes={nursingHomes || []} />
            </main>
        </div>
    )
}
