'use server'

import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const COMPONENT = "InviteUserAction"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function inviteUser(email: string, facilityId: string) {
  try {
    const { data: facility, error: facilityError } = await supabase
      .from('facilities')
      .select('name')
      .eq('id', facilityId)
      .single()

    if (facilityError) {
      logger.error(COMPONENT, "Failed to fetch facility", { 
        error: facilityError,
        facilityId 
      })
      throw new Error("Could not find facility")
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
        data: {
          facility_id: facilityId,
          facility_name: facility?.name
        }
      }
    )

    if (inviteError) {
      logger.error(COMPONENT, "Failed to send invite", { 
        error: inviteError,
        email 
      })
      throw new Error("Failed to send invitation email")
    }

    if (!inviteData?.user?.id) {
      logger.error(COMPONENT, "No user ID in invite response")
      throw new Error("Invalid invite response")
    }

    console.log("Invite data:", inviteData)

    // Create user record
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        id: inviteData.user.id,
        email,
        status: 'pending'
      }])

    if (userError) {
      logger.error(COMPONENT, "Failed to create user record", { 
        error: userError,
        userId: inviteData.user.id 
      })
      throw new Error("Failed to create user record")
    }

    //Create facility association
    const { error: facilityError2 } = await supabase
      .from('user_roles')
      .insert([{
        user_id: inviteData.user.id,
        facility_id: facilityId,
        role: 'facility_admin'
      }])

    if (facilityError2) {
      logger.error(COMPONENT, "Failed to associate user with facility", { 
        error: facilityError2,
        userId: inviteData.user.id,
        facilityId 
      })
      throw new Error("Failed to associate user with facility")
    }

    logger.info(COMPONENT, "User invited successfully", { 
      email,
      userId: inviteData.user.id,
      facilityId,
      facilityName: facility?.name
    })

    return { 
      success: true, 
      userId: inviteData.user.id,
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