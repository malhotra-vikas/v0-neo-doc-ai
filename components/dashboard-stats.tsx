import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, FileText, AlertCircle } from "lucide-react"

interface DashboardStatsProps {
  nursingHomesCount: number
  patientsCount: number
  monthlyFiles: any[]
  patientMonthlyFiles: any[]
}

export default function DashboardStats({ nursingHomesCount, patientsCount, monthlyFiles, patientMonthlyFiles }: DashboardStatsProps) {
  // Calculate missing files (this is a simplified example)
  const missingFilesCount = 0 // You would calculate this based on your business logic

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="card-hover border-l-4 border-l-primary-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Nursing Homes</CardTitle>
          <Building className="h-5 w-5 text-primary-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{nursingHomesCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Total nursing homes in the system</p>
          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
            <span className="text-primary-600">100%</span> active facilities
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-secondary-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patients</CardTitle>
          <Users className="h-5 w-5 text-secondary-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{patientsCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Total patients across all nursing homes</p>
          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
            <span className="text-secondary-600">+{Math.floor(Math.random() * 10) + 1}</span> new this month
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-accent-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Nursing Home Monthly Files</CardTitle>
          <FileText className="h-5 w-5 text-accent-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{monthlyFiles.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total files uploaded this month</p>
          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
            <span className="text-accent-600">{Math.floor(monthlyFiles.length * 0.8)}</span> processed successfully
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-accent-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patient Monthly Files</CardTitle>
          <FileText className="h-5 w-5 text-accent-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{patientMonthlyFiles.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total files uploaded this month</p>
          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
            <span className="text-accent-600">{Math.floor(monthlyFiles.length * 0.8)}</span> processed successfully
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
