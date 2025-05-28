'use client'

import { UserContextType, UserProvider } from "@/components/providers/user-provider"
import { ReactNode } from "react"


interface Props {
  children: ReactNode
  value: UserContextType
}

export default function UserProviderWrapper({ children, value }:Props) {
  return <UserProvider value={value}>{children}</UserProvider>
}