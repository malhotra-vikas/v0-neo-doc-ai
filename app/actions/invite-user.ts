'use server'

import { logger } from '@/lib/logger'
import { UserRole, UserStatus } from '@/types/enums'
import { getServerDatabase } from '@/lib/services/supabase/get-service'
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { app } from '@/config/firebase/firebase'

const COMPONENT = "InviteUserAction"

export async function inviteUser(
  email: string, 
  facilityId?: string, 
  role: UserRole = UserRole.FACILITY_ADMIN
) {
  const db = getServerDatabase()
  const auth = getAuth(app)

  try {
    let facility: { name?: string } | undefined;
    if (facilityId) {
      const { data } = await db.getFacility(facilityId)
      facility = data
    }


    // Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, 'password')
    const user = userCredential.user

    if (!user.uid) {
      logger.error(COMPONENT, "No user ID in response")
      throw new Error("Invalid user creation response")
    }

    await sendEmailVerification(user, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/callback?email=${encodeURIComponent(email)}&type=verify`,
      handleCodeInApp: true,
    })

    // Create user in database
    const { error: userError } = await db.createUser({
      id: user.uid,
      email,
      status: UserStatus.PENDING
    })

    if (userError) {
      logger.error(COMPONENT, "Failed to create user record", {
        error: userError,
        userId: user.uid
      })
      throw new Error("Failed to create user record")
    }

    // Assign user role
    const { error: roleError } = await db.assignUserRole({
      user_id: user.uid,
      facility_id: facilityId,
      role: role
    })

    if (roleError) {
      logger.error(COMPONENT, "Failed to assign user role", {
        error: roleError,
        userId: user.uid,
        facilityId
      })
      throw new Error("Failed to assign user role")
    }

    logger.info(COMPONENT, "User invited successfully", {
      email,
      userId: user.uid,
      facilityId,
      facilityName: facility?.name
    })

    return {
      success: true,
      userId: user.uid,
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