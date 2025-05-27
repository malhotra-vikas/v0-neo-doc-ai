import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

export default function Loading() {
    return (
        <div className="flex flex-col min-h-screen">
            <div className="sticky top-0 z-40 border-b bg-white shadow-sm h-[65px]" />

            <main className="flex-1 container mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

                <Card className="w-full shadow-md border-slate-200">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                        <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <ClipboardList className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-slate-800">Audit Logs</CardTitle>
                                <CardDescription className="mt-1">Comprehensive audit trail of all system activities</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>

                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
