"use server"

import { logger } from "@/lib/logger"
import { getFirebaseAdmin } from "@/lib/firebase/admin"
import { getAuth, sendPasswordResetEmail } from "firebase/auth"
import { createClient } from "@supabase/supabase-js"
import { app } from "@/config/firebase/firebase"
import { ActionCodeSettings } from "firebase-admin/auth"

const COMPONENT = "reset-password-action"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function initiatePasswordReset(email: string) {
  const auth = getAuth(app)

  try {
    // Check if user exists in Firebase
    const adminAuth = getFirebaseAdmin()
    const userRecord = await adminAuth.getUserByEmail(email)
    
    if (!userRecord) {
      logger.error(COMPONENT, "No user found with email", { email })
      throw new Error("No account found with this email address")
    }

    // Send password reset email
    await sendPasswordResetEmail(auth, email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/callback?type=resetPassword`,
      handleCodeInApp: true,
    })

    logger.info(COMPONENT, "Password reset email sent", { email })

    return {
      success: true,
      message: "Password reset link sent to your email"
    }

  } catch (error: any) {
    logger.error(COMPONENT, "Failed to send reset email", {
      error: error.message,
      email
    })    
    
    return {
      success: false,
      error: error.message || "Failed to send reset link"
    }
  }
}