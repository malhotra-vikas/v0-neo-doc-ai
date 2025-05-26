import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ReportGenerator } from "@/components/report-generator"
import { PageViewLogger } from "@/components/page-view-logger"

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
            <PageViewLogger user={session.user} pageName="Reports" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Reports</h1>
                <ReportGenerator nursingHomes={nursingHomes || []} />
            </main>
        </div>
    )
}
