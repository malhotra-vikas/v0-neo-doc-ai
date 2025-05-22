"use client"

import type React from "react"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ClipboardList,
    Search,
    Filter,
    Download,
    RefreshCw,
    Calendar,
    UserIcon,
    FileText,
    Building2,
    Upload,
    Trash2,
    Eye,
    Edit,
    LogIn,
    LogOut,
    BarChart3,
    Loader2,
    Info,
} from "lucide-react"
import { logAuditEvent, type AuditActionType, type AuditEntityType } from "@/lib/audit-logger"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface AuditLog {
    id: string
    user_id: string
    user_email: string
    action_type: AuditActionType
    entity_type: AuditEntityType
    entity_id: string | null
    details: Record<string, any>
    ip_address: string | null
    user_agent: string | null
    created_at: string
}

interface AuditLogViewerProps {
    initialLogs: AuditLog[]
    users: { user_id: string; user_email: string }[]
    currentUser: User
}

export function AuditLogViewer({ initialLogs, users, currentUser }: AuditLogViewerProps) {
    const [logs, setLogs] = useState<AuditLog[]>(initialLogs)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedUser, setSelectedUser] = useState<string>("all")
    const [selectedAction, setSelectedAction] = useState<string>("all")
    const [selectedEntity, setSelectedEntity] = useState<string>("all")
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
    })

    const supabase = createClientComponentClient()

    // Log the view event when the component mounts
    useEffect(() => {
        logAuditEvent({
            user: currentUser,
            actionType: "view",
            entityType: "audit_logs",
            details: { page: "audit_logs" },
        })
    }, [currentUser])

    const fetchLogs = async () => {
        setLoading(true)

        try {
            let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false })

            // Apply filters
            if (selectedUser !== "all") {
                query = query.eq("user_id", selectedUser)
            }

            if (selectedAction !== "all") {
                query = query.eq("action_type", selectedAction)
            }

            if (selectedEntity !== "all") {
                query = query.eq("entity_type", selectedEntity)
            }

            if (dateRange.start) {
                query = query.gte("created_at", `${dateRange.start}T00:00:00`)
            }

            if (dateRange.end) {
                query = query.lte("created_at", `${dateRange.end}T23:59:59`)
            }

            if (searchTerm) {
                query = query.or(`user_email.ilike.%${searchTerm}%,entity_id.ilike.%${searchTerm}%`)
            }

            const { data, error } = await query.limit(100)

            if (error) {
                throw error
            }

            setLogs(data || [])
        } catch (error) {
            console.error("Error fetching audit logs:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = () => {
        fetchLogs()
    }

    const handleExport = () => {
        // Convert logs to CSV
        const headers = ["Date", "User", "Action", "Entity Type", "Entity ID", "Details"]
        const csvContent = [
            headers.join(","),
            ...logs.map((log) =>
                [
                    new Date(log.created_at).toLocaleString(),
                    log.user_email,
                    log.action_type,
                    log.entity_type,
                    log.entity_id || "",
                    JSON.stringify(log.details),
                ].join(","),
            ),
        ].join("\n")

        // Create download link
        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Log the export event
        logAuditEvent({
            user: currentUser,
            actionType: "download",
            entityType: "audit_logs",
            details: { format: "csv", count: logs.length },
        })
    }

    const getActionIcon = (actionType: AuditActionType) => {
        switch (actionType) {
            case "login":
                return <LogIn className="h-4 w-4 text-blue-500" />
            case "logout":
                return <LogOut className="h-4 w-4 text-slate-500" />
            case "create":
                return <FileText className="h-4 w-4 text-green-500" />
            case "update":
                return <Edit className="h-4 w-4 text-amber-500" />
            case "delete":
                return <Trash2 className="h-4 w-4 text-red-500" />
            case "view":
                return <Eye className="h-4 w-4 text-blue-500" />
            case "download":
                return <Download className="h-4 w-4 text-purple-500" />
            case "upload":
                return <Upload className="h-4 w-4 text-indigo-500" />
            case "process":
                return <RefreshCw className="h-4 w-4 text-cyan-500" />
            case "generate_report":
                return <BarChart3 className="h-4 w-4 text-emerald-500" />
            default:
                return <Info className="h-4 w-4 text-slate-500" />
        }
    }

    const getEntityIcon = (entityType: AuditEntityType) => {
        switch (entityType) {
            case "user":
                return <UserIcon className="h-4 w-4 text-blue-500" />
            case "nursing_home":
                return <Building2 className="h-4 w-4 text-green-500" />
            case "patient":
                return <UserIcon className="h-4 w-4 text-amber-500" />
            case "patient_file":
                return <FileText className="h-4 w-4 text-red-500" />
            case "nursing_home_file":
                return <FileText className="h-4 w-4 text-purple-500" />
            case "pdf_queue":
                return <RefreshCw className="h-4 w-4 text-cyan-500" />
            case "report":
                return <BarChart3 className="h-4 w-4 text-emerald-500" />
            default:
                return <Info className="h-4 w-4 text-slate-500" />
        }
    }

    const actionTypes: AuditActionType[] = [
        "login",
        "logout",
        "create",
        "update",
        "delete",
        "view",
        "download",
        "upload",
        "process",
        "generate_report",
    ]

    const entityTypes: AuditEntityType[] = [
        "user",
        "nursing_home",
        "patient",
        "patient_file",
        "nursing_home_file",
        "pdf_queue",
        "report",
    ]

    return (
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
            <CardContent className="p-0">
                <div className="p-6 border-b bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search logs..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                            <SelectTrigger>
                                <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Filter by user" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map((user) => (
                                    <SelectItem key={user.user_id} value={user.user_id}>
                                        {user.user_email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedAction} onValueChange={setSelectedAction}>
                            <SelectTrigger>
                                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Filter by action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {actionTypes.map((action) => (
                                    <SelectItem key={action} value={action}>
                                        {action.replace("_", " ").charAt(0).toUpperCase() + action.replace("_", " ").slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                            <SelectTrigger>
                                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Filter by entity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                {entityTypes.map((entity) => (
                                    <SelectItem key={entity} value={entity}>
                                        {entity.replace("_", " ").charAt(0).toUpperCase() + entity.replace("_", " ").slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="start-date" className="text-sm w-20">
                                Start Date:
                            </Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Label htmlFor="end-date" className="text-sm w-20">
                                End Date:
                            </Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                            <Button variant="outline" onClick={handleExport} disabled={logs.length === 0 || loading}>
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="w-full rounded-none justify-start border-b bg-slate-50">
                        <TabsTrigger value="all" className="data-[state=active]:bg-white">
                            All Logs
                        </TabsTrigger>
                        <TabsTrigger value="login" className="data-[state=active]:bg-white">
                            Login/Logout
                        </TabsTrigger>
                        <TabsTrigger value="data" className="data-[state=active]:bg-white">
                            Data Changes
                        </TabsTrigger>
                        <TabsTrigger value="files" className="data-[state=active]:bg-white">
                            File Operations
                        </TabsTrigger>
                    </TabsList>

                    <div className="overflow-x-auto">
                        <TabsContent value="all" className="m-0">
                            <AuditLogTable
                                logs={logs}
                                loading={loading}
                                getActionIcon={getActionIcon}
                                getEntityIcon={getEntityIcon}
                            />
                        </TabsContent>

                        <TabsContent value="login" className="m-0">
                            <AuditLogTable
                                logs={logs.filter((log) => log.action_type === "login" || log.action_type === "logout")}
                                loading={loading}
                                getActionIcon={getActionIcon}
                                getEntityIcon={getEntityIcon}
                            />
                        </TabsContent>

                        <TabsContent value="data" className="m-0">
                            <AuditLogTable
                                logs={logs.filter((log) => ["create", "update", "delete"].includes(log.action_type))}
                                loading={loading}
                                getActionIcon={getActionIcon}
                                getEntityIcon={getEntityIcon}
                            />
                        </TabsContent>

                        <TabsContent value="files" className="m-0">
                            <AuditLogTable
                                logs={logs.filter((log) => ["upload", "download", "process"].includes(log.action_type))}
                                loading={loading}
                                getActionIcon={getActionIcon}
                                getEntityIcon={getEntityIcon}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t px-6 py-4">
                <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="text-xs text-muted-foreground">
                        <p>Showing {logs.length} audit log entries. Export to CSV for a complete record.</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleString()}</span>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}

interface AuditLogTableProps {
    logs: AuditLog[]
    loading: boolean
    getActionIcon: (actionType: AuditActionType) => React.ReactNode
    getEntityIcon: (entityType: AuditEntityType) => React.ReactNode
}

function AuditLogTable({ logs, loading, getActionIcon, getEntityIcon }: AuditLogTableProps) {
    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg">Loading audit logs...</span>
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Audit Logs Found</h3>
                <p className="text-sm text-muted-foreground">
                    No logs match your current filter criteria. Try adjusting your filters.
                </p>
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[180px]">User</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead className="w-[150px]">Entity Type</TableHead>
                    <TableHead className="w-[180px]">Entity ID</TableHead>
                    <TableHead>Details</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs.map((log) => (
                    <TableRow key={log.id} className="group">
                        <TableCell className="font-mono text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                            <div className="flex items-center">
                                <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">{log.user_email}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                {getActionIcon(log.action_type)}
                                <span className="capitalize">{log.action_type.replace("_", " ")}</span>
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit bg-slate-50">
                                {getEntityIcon(log.entity_type)}
                                <span className="capitalize">{log.entity_type.replace("_", " ")}</span>
                            </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[150px]">{log.entity_id || "-"}</TableCell>
                        <TableCell>
                            {Object.keys(log.details || {}).length > 0 ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                            View Details
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-sm">Event Details</h4>
                                            <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-60">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                            {log.ip_address && (
                                                <div className="text-xs">
                                                    <span className="font-medium">IP Address:</span> {log.ip_address}
                                                </div>
                                            )}
                                            {log.user_agent && (
                                                <div className="text-xs">
                                                    <span className="font-medium">User Agent:</span>
                                                    <div className="truncate">{log.user_agent}</div>
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <span className="text-muted-foreground text-xs">No details</span>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
