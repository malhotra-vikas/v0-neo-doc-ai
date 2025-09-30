import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ReportGenerator } from "@/components/report-generator"
import { PageViewLogger } from "@/components/page-view-logger"
import { NoCopyGuard } from "@/components/no-copy-guard"
import { getServerDatabase } from "@/lib/services/supabase/get-service"
import { NursingHome } from "@/types"
import { UserRole } from "@/types/enums"

export default async function ReportsPage() {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    const db = getServerDatabase()
    const facility = await db.getFacilityIdByUserId(session.user.id)
  
    let nursingHomes:Pick<NursingHome,"id"|"name">[] = [];
    if(facility.data?.role == UserRole.SUPER_ADMIN){
        const { data: nursingHomeValues } = await db.getNursingHomes()
        nursingHomes = nursingHomeValues ?? [];
      }
    if(facility.data?.facility_id){
        const { data: nursingHomeValues } = await supabase.from("nursing_homes").select("id, name, us_state").eq("facility_id", facility.data?.facility_id)
        nursingHomes = nursingHomeValues ?? [];
    }

    return (
        <NoCopyGuard className="flex flex-col min-h-screen">
            <PageViewLogger user={session.user} pageName="Reports" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Reports</h1>
                <ReportGenerator nursingHomes={nursingHomes || []} />
            </main>
        </NoCopyGuard>
    )
}
