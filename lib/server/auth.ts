import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase/admin'
import { UserRole } from '@/types/enums'
import { getServerDatabase } from '../services/supabase/get-service'
import { SerializableUser } from '@/types'


interface ServerUser {
    user: SerializableUser
    role: UserRole | null
    facilityId: string | null
}


export async function getServerUser(): Promise<ServerUser | null> {
  let attempts = 0;
  const maxAttempts = 5;
  const interval = 500;

  while (attempts < maxAttempts) {
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('session')?.value;
 
      if (!sessionCookie) {
        attempts++;
        if (attempts === maxAttempts) {
          return null
        }
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }

      const auth = getFirebaseAdmin();
      const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
      const firebaseUser = await auth.getUser(decodedToken.uid);

      const db = getServerDatabase();
      const { data: roleData } = await db.getUserRoleByUserId(decodedToken.uid);

      const serializableUser: SerializableUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        emailVerified: firebaseUser.emailVerified,
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        metadata: {
          creationTime: firebaseUser.metadata.creationTime,
          lastSignInTime: firebaseUser.metadata.lastSignInTime
        }
      };

      return {
          user: serializableUser,
          role: roleData?.role || null,
          facilityId: roleData?.facility_id || null
      };

    } catch (error) {
      attempts++;
      if (attempts === maxAttempts) {
        console.error('Server auth error:', error);
        return null;
      }
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  return null
}