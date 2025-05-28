"use server"

import { logger } from "@/lib/logger"
import { getServerDatabase } from "@/lib/services/supabase/get-service"
import { createClient } from "@supabase/supabase-js"

const COMPONENT = "reset-password-action"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


export async function initiatePasswordReset(email: string) {
     const db =getServerDatabase()

  try {
    const { data: user } = await db.getUserByEmail(email)
    console.log("User data:", user,email)
    
    if (!user) {
      throw ("No account found with this email address")
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    })

    if (resetError) {
     logger.error(COMPONENT, "Failed to send reset email",resetError)
      throw ("Failed to send reset email")
    }

    return {
      success: true,
      message: "Password reset link sent to your email"
    }

  } catch (error: any) {
    logger.error(COMPONENT, "Failed to send reset email",error)    
    return {
      success: false,
      error: error || error.message || "Failed to send reset link"
    }
  }
}