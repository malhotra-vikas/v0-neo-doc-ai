import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, FileText, AlertCircle } from "lucide-react"

interface DashboardStatsProps {
  nursingHomesCount: number
  patientsCount: number
  monthlyFiles: any[]
}

export default function DashboardStats({ nursingHomesCount, patientsCount, monthlyFiles }: DashboardStatsProps) {
  // Calculate missing files (this is a simplified example)
  const missingFilesCount = 0 // You would calculate this based on your business logic

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Nursing Homes</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{nursingHomesCount}</div>
          <p className="text-xs text-muted-foreground">Total nursing homes in the system</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{patientsCount}</div>
          <p className="text-xs text-muted-foreground">Total patients across all nursing homes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Files</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{monthlyFiles.length}</div>
          <p className="text-xs text-muted-foreground">Total files uploaded this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Missing Files</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{missingFilesCount}</div>
          <p className="text-xs text-muted-foreground">Files that need to be uploaded</p>
        </CardContent>
      </Card>
    </div>
  )
}
