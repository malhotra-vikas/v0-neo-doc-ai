"use client"

import Link from "next/link"
import type { User } from "@supabase/auth-helpers-nextjs"
import { useRouter, usePathname } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LogOut,
  UserIcon,
  Upload,
  FileText,
  LayoutDashboard,
  Settings,
  HelpCircle,
  BarChart3,
  ClipboardList,
  Building2,
} from "lucide-react"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"

// Import the audit logger at the top of the file
import { logAuditEvent } from "@/lib/audit-logger"
type UserRole = 'superadmin' | 'facility_admin' | 'facility_user';


interface DashboardHeaderProps {
  user: User
  userRole?: UserRole;
}

export default function DashboardHeader({ user,userRole }: DashboardHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  // Update the handleSignOut function to log logout events
  const handleSignOut = async () => {
    // Log logout event before signing out
    logAuditEvent({
      user: user,
      actionType: "logout",
      entityType: "user",
      entityId: user.id,
      details: { method: "manual" },
    })

    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const userInitials = user.email ? user.email.substring(0, 2).toUpperCase() : "U"

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Bulk Upload",
      href: "/bulk-upload",
      icon: Upload,
    },
    {
      name: "PDF Queue",
      href: "/admin/pdf-queue",
      icon: FileText,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      name: "Audit Logs",
      href: "/audit-logs",
      icon: ClipboardList,
    },
      ...(userRole === 'superadmin' ? [{
        name: "Facilities",
        href: "/admin/facilities",
        icon: Building2, 
    }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
      <div className="container mx-auto py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Logo />

            <nav className="hidden md:block">
              <ul className="flex space-x-6">
                {navItems.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center transition-colors",
                        pathname === item.href
                          ? "text-primary-600 font-medium"
                          : "text-gray-600 hover:text-primary-600",
                      )}
                    >
                      <item.icon className="mr-1 h-4 w-4" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="hidden md:flex">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 border border-primary-100">
                    <AvatarFallback className="bg-primary-50 text-primary-700">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>{user.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
