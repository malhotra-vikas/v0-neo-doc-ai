import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase/admin'
import { UserRole } from '@/types/enums'
import { getServerDatabase } from '../services/supabase/get-service'
import { User } from 'firebase/auth'

interface ServerUser {
    user: User
    role: UserRole | null
    facilityId: string | null
}

export async function getServerUser(): Promise<ServerUser | null> {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get('session')?.value

        if (!sessionCookie) {
            return null
        }
        const auth = getFirebaseAdmin()
        const decodedToken = await auth.verifySessionCookie(sessionCookie, true)
        const firebaseUser = await auth.getUser(decodedToken.uid)

        const db = getServerDatabase()
        const { data: roleData } = await db.getUserRoleByUserId(decodedToken.uid)

        // Convert admin SDK user to Auth user type
        const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName ?? '',
            photoURL: firebaseUser.photoURL ?? '',
            phoneNumber: firebaseUser.phoneNumber ?? '',
            isAnonymous: false,
            tenantId: firebaseUser.tenantId ?? '',
            providerData: firebaseUser.providerData,
            metadata: {
                creationTime: firebaseUser.metadata.creationTime,
                lastSignInTime: firebaseUser.metadata.lastSignInTime,
            },
            refreshToken: '', // Admin SDK doesn't have refresh tokens
            delete: async () => Promise.resolve(),
            getIdToken: async () => Promise.resolve(''),
            getIdTokenResult: async () => Promise.resolve({
                token: '',
                authTime: '',
                issuedAtTime: '',
                expirationTime: '',
                signInProvider: null,
                claims: {},
                signInSecondFactor: null,
            }),
            reload: async () => Promise.resolve(),
            toJSON: () => ({ uid: firebaseUser.uid }),
            providerId:""
        }

        return {
            user,
            role: roleData?.role || null,
            facilityId: roleData?.facility_id || null
        }
    } catch (error) {
        console.error('Server auth error:', error)
        return null
    }
}