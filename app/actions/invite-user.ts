'use server'

import { logger } from '@/lib/logger'
import { UserRole, UserStatus } from '@/types/enums'
import { getServerDatabase } from '@/lib/services/supabase/get-service'
import { getFirebaseAdmin } from '@/lib/firebase/admin'

const COMPONENT = "InviteUserAction"

export async function inviteUser(email: string, facilityId?: string, role: UserRole = UserRole.FACILITY_ADMIN) {
  const db = getServerDatabase()
  const auth = getFirebaseAdmin()

  try {
    let facility: { name?: string } | undefined;
    if (facilityId) {
      const { data } = await db.getFacility(facilityId)
      facility = data;
    }

    const inviteData = await auth.createUser({
      email,
      emailVerified: false,
    });

    if (!inviteData.uid) {
      logger.error(COMPONENT, "No user ID in invite response")
      throw new Error("Invalid invite response")
    }

    const { error: userError } = await db.createUser({
      id: inviteData.uid,
      email,
      status: UserStatus.PENDING
    });

    if (userError) {
      logger.error(COMPONENT, "Failed to create user record", {
        error: userError,
        userId: inviteData.uid
      })
      throw new Error("Failed to create user record")
    }

    const { error: facilityError2 } = await db.assignUserRole({
      user_id: inviteData.uid,
      facility_id: facilityId,
      role: role
    })

    if (facilityError2) {
      logger.error(COMPONENT, "Failed to associate user with facility", {
        error: facilityError2,
        userId: inviteData.uid,
        facilityId
      })
      throw new Error("Failed to associate user with facility")
    }

    logger.info(COMPONENT, "User invited successfully", {
      email,
      userId: inviteData.uid,
      facilityId,
      facilityName: facility?.name
    })

    return {
      success: true,
      userId: inviteData.uid,
      email,
      facilityName: facility?.name
    }

  } catch (error: any) {
    logger.error(COMPONENT, "Invite user error", {
      error: error.message,
      email,
      facilityId,
      stack: error.stack
    })

    throw {
      code: 'INVITE_ERROR',
      message: error.message || 'Failed to invite user',
      details: error.details || {}
    }
  }
}