import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { cache } from "react"

export const createServerSupabaseClient = cache(() => {
  const cookieStore =  cookies()
  return createServerComponentClient({ cookies: () => cookieStore })
})

export async function getSession() {
  const supabase = createServerSupabaseClient()
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

export async function getNursingHomes() {
  const supabase = createServerSupabaseClient()
  try {
    const { data, error } = await supabase.from("nursing_homes").select("*, patients(*)")

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error:", error)
    return []
  }
}

export async function getPatients(nursingHomeId?: string) {
  const supabase = createServerSupabaseClient()
  try {
    let query = supabase.from("patients").select("*")

    if (nursingHomeId) {
      query = query.eq("nursing_home_id", nursingHomeId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error:", error)
    return []
  }
}

export async function getNursingHomeFiles(nursingHomeId?: string) {
  const supabase = createServerSupabaseClient()
  try {
    let query = supabase.from("nursing_home_files").select("*")

    if (nursingHomeId) {
      query = query.eq("nursing_home_id", nursingHomeId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error:", error)
    return []
  }
}
