"use client"

import { createContext, useContext, ReactNode } from 'react'
import type { User } from '@supabase/auth-helpers-nextjs'
import { UserRole } from '@/types/enums'

export interface UserContextType {
  user: User | null
  userRole?: UserRole | null
  facilityId?: string | null
}
const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
  value: UserContextType
}

export function UserProvider({ children, value }: UserProviderProps) {
 
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}