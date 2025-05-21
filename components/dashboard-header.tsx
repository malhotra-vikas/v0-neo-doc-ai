"use client"

import type { User } from "@supabase/supabase-js"

interface DashboardHeaderProps {
  user: User | null
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="bg-gray-100 py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div>
          {user ? (
            <span className="text-gray-700">Welcome, {user.email}</span>
          ) : (
            <span className="text-gray-700">Not logged in</span>
          )}
        </div>
      </div>
    </header>
  )
}
