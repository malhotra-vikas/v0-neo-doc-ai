"use client"

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { User, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { redirect, usePathname } from 'next/navigation'
import { auth } from '@/config/firebase/firebase'
import { UserRole, UserStatus } from '@/types/enums'
import { getClientDatabase } from '@/lib/services/supabase'
import { SerializableUser, ServerUser } from '@/types'

const PUBLIC_PATHS = ['/login', '/callback', '/forgot-password']

interface AuthContextType {
    user: SerializableUser | null |User
    loading: boolean
    userRole: UserRole | null
    facilityId: string | null
    signIn: (email: string, password: string) => Promise<User>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: false,
    userRole: null,
    facilityId: null,
    signIn: async () => { throw new Error('Not implemented') },
    logout: async () => { throw new Error('Not implemented') }
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState({
        user: null as SerializableUser | null | User,
        userRole: null as UserRole | null,
        facilityId: null as string | null,
        loading: false,
    })
    
    const pathname = usePathname()
    const isPublicRoute = PUBLIC_PATHS.some(path => pathname?.startsWith(path))

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' })
            await signOut(auth)
            setState(prev => ({
                ...prev,
                user: null,
                userRole: null,
                facilityId: null,
                loading: false
            }))
            if (!isPublicRoute) {
                redirect("/login")
            }
        } catch (error) {
            console.error('Logout error:', error)
            if (!isPublicRoute) {
                redirect("/login")
            }
        }
    }, [isPublicRoute])

    useEffect(() => {
        let mounted = true;
        
        async function checkAuthState() {
            try {
                if (!mounted) return;
                setState(prev => ({ ...prev, loading: true }))

                const verifyResponse = await fetch('/api/auth/verify-session')
                const { isValid } = await verifyResponse.json()

                // Don't redirect on public routes even if session is invalid
                if (!verifyResponse.ok || !isValid) {
                    if (!isPublicRoute) {
                        await handleLogout()
                    } else {
                        setState(prev => ({ ...prev, loading: false }))
                    }
                    return;
                }

                const userResponse = await fetch('/api/auth/user')
                const data: ServerUser = await userResponse.json()
                
                if (data.user) {
                    setState(prev => ({
                        ...prev,
                        user: data.user,
                        userRole: data.role,
                        facilityId: data.facilityId,
                        loading: false
                    }))
                } else if (!isPublicRoute) {
                    await handleLogout()
                } else {
                    setState(prev => ({ ...prev, loading: false }))
                }
            } catch (error) {
                if (mounted && !isPublicRoute) {
                    await handleLogout()
                } else {
                    setState(prev => ({ ...prev, loading: false }))
                }
            }
        }

        checkAuthState()
        
        return () => { mounted = false }
    }, [handleLogout, isPublicRoute])

    const signIn = async (email: string, password: string) => {
        try {
            const db = getClientDatabase()
            const { data: userData, error: userError } = await db.getUserStatusByEmail(email)

            if (userError || !userData) {
                throw new Error('User not found')
            }

            if (userData.status !== UserStatus.ACTIVE) {
                throw new Error('Your account is not active. Please contact support.')
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const idToken = await userCredential.user.getIdToken()
            const { data: roleData, error: roleError } = await db.getUserRoleByUserId(userCredential.user.uid)
            setState(prev => ({ ...prev, loading: true }))
            if (roleError) {
                throw new Error('Failed to fetch user role')
            }

            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken })
            })

            if (!sessionResponse.ok) {
                throw new Error('Failed to create session')
            }
            let retries = 0;
            const maxRetries = 5;
            while (retries < maxRetries) {
                const verifyResponse = await fetch('/api/auth/verify-session')
                if (verifyResponse.ok) {
                    const { isValid } = await verifyResponse.json()
                    if (isValid) {
                        break;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }

            if (retries === maxRetries) {
                throw new Error('Failed to verify session')
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