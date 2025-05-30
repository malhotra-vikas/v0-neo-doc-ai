"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/config/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { UserRole } from '@/types/enums'
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
    const [user, setUser] = useState<User | null>(null)
    const [userRole, setUserRole] = useState<UserRole | null>(null)
    const [facilityId, setFacilityId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user)

                const db = getClientDatabase()
                const { data: roleData, error } = await db.getUserRoleByUserId(user.uid)

                if (!error && roleData) {
                    setUserRole(roleData.role)
                    setFacilityId(roleData.facility_id)
                }
            } else {
                setUser(null)
                setUserRole(null)
                setFacilityId(null)
                router.push('/login')
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [router])

    const signIn = async (email: string, password: string) => {
         try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            
            const idToken = await userCredential.user.getIdToken()
            
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

            return userCredential.user
        } catch (error) {
            console.error('Sign in error:', error)
            throw error
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
            // Clear session cookie
            await fetch('/api/auth/session', {
                method: 'DELETE'
            })
            router.push('/login')
        } catch (error) {
            console.error('Logout error:', error)
            throw error
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            userRole,
            facilityId,
            signIn,
            logout
        }}>
            {!loading && children}
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