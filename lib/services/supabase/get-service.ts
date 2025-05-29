import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { DatabaseService } from './db'

export function getServerDatabase() {
  const supabase = createServerComponentClient({ cookies })
  return new DatabaseService(supabase)
}