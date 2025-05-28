import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function Loading() {
    return (
        <div className="flex flex-col min-h-screen">
            <div className="sticky top-0 z-40 border-b bg-white shadow-sm h-[65px]" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Reports</h1>

                <Card className="w-full shadow-md border-slate-200">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                        <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <BarChart3 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-slate-800">Report Generator</CardTitle>
                                <CardDescription className="mt-1">
                                    Generate comprehensive reports for nursing homes by month
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>

                            <div className="flex justify-end">
                                <Skeleton className="h-10 w-[150px]" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
