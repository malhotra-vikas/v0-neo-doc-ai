import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { DatabaseService } from './db'

export function getClientDatabase() {
  const supabase = createClientComponentClient()
  return new DatabaseService(supabase)
}