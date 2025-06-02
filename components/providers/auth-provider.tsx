"use client"

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { User, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { redirect } from 'next/navigation'
import { auth } from '@/config/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { UserRole, UserStatus } from '@/types/enums'
import { getClientDatabase } from '@/lib/services/supabase'

interface AuthContextType {
    user: User | null
    loading: boolean
    userRole: UserRole | null
    facilityId: string | null
    signIn: (email: string, password: string) => Promise<User>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    userRole: null,
    facilityId: null,
    signIn: async () => { throw new Error('Not implemented') },
    logout: async () => { throw new Error('Not implemented') }
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState({
        user: null as User | null,
        userRole: null as UserRole | null,
        facilityId: null as string | null,
        loading: true,
    })
    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' })
            await signOut(auth)
            redirect("/login")
        } catch (error) {
            console.error('Logout error:', error)
        }
    }, [])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    const db = getClientDatabase()
                    const { data: roleData, error } = await db.getUserRoleByUserId(user.uid)

                    if (error) {
                        console.error('Error fetching user role:', error)
                        await handleLogout()
                        return
                    }

                    setState(prev => ({
                        ...prev,
                        user,
                        userRole: roleData?.role || null,
                        facilityId: roleData?.facility_id || null,
                        loading: false
                    }))
                } else {
                    setState(prev => ({
                        ...prev,
                        user: null,
                        userRole: null,
                        facilityId: null,
                        loading: false
                    }))
                }
            } catch (error) {
                console.error('Auth state change error:', error)
                await handleLogout()
            }
        })

        return () => unsubscribe()
    }, [handleLogout])

    const signIn = async (email: string, password: string) => {
        try {
            setState(prev => ({ ...prev, loading: true }))
            
            const db = getClientDatabase()
            const { data: userData, error: userError } = await db.getUserStatusByEmail(email)

            if (userError || !userData) {
                throw new Error('Failed to verify user status')
            }

            if (userData.status !== UserStatus.ACTIVE) {
                throw new Error('Your account is not active. Please contact support.')
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const idToken = await userCredential.user.getIdToken()
            
            const { data: roleData, error: roleError } = await db.getUserRoleByUserId(userCredential.user.uid)
            
            if (roleError) {
                throw new Error('Failed to fetch user role')
            }

            // Create session first
            const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken })
            })
            if (!response.ok) {
                throw new Error('Failed to create session')
            }

            setState(prev => ({
                ...prev,
                user: userCredential.user,
                userRole: roleData?.role || null,
                facilityId: roleData?.facility_id || null,
                loading: false,
            }))

            return userCredential.user
        } catch (error) {
            setState(prev => ({ ...prev, loading: false }))
            throw error
        }
    }

    return (
        <AuthContext.Provider value={{
            user: state.user,
            loading: state.loading,
            userRole: state.userRole,
            facilityId: state.facilityId,
            signIn,
            logout: handleLogout
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}