import { SupabaseClient } from '@supabase/supabase-js'
import type { User, UserRoleAssignment } from '@/types'
import { UserRole } from '@/types/enums';

export class DatabaseService {

  constructor(private supabase: SupabaseClient) {}
  async createUser(userData: Partial<User>) {
    return await this.supabase
      .from("users")
      .insert([userData])
      .select()
      .single();
  }

  async getUserByEmail(email: string) {
    return await this.supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
  }

  async assignUserRole(roleData: Partial<UserRoleAssignment>) {
    return await this.supabase
      .from("user_roles")
      .insert([roleData])
      .select()
      .single();
  }

  async getFacility(facilityId: string) {
    return await this.supabase
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .single();
  }

  async getFacilityUsers(facilityId: string) {
    return await this.supabase
      .from("users")
      .select(
        `
        *,
        user_roles!inner(
          role,
          facility_id
        )
      `
      )
      .eq("user_roles.facility_id", facilityId);
  }
async getUsersWithRole(facilityId: string | null, inviteUserRole?: UserRole | null,userId?:string|null) {
  let query = this.supabase
    .from('user_roles')
    .select(`
      id,
      user_id,
      role,
      facility_id,
      created_at,
      users:users!user_roles_user_id_fkey(
        id,
        email,
        status,
        created_at
      )
    `);

  if (facilityId) {
    query = query.eq('facility_id', facilityId);
  }

  if(userId){
    query = query.neq('user_id', userId);
  }

  if (inviteUserRole) {
    query = query.eq('role', inviteUserRole);
  }

  console.log("Querying users with role:", query);
  return await query;
}

async getFacilityIdByUserId(userId: string) {
    return await this.supabase
      .from("user_roles")
      .select("facility_id,role")
      .eq("user_id", userId)
      .maybeSingle();
  }

async getNursingHomesByFacilityId(facilityId: string) {
    return await this.supabase
      .from("nursing_homes")
      .select("id, name, us_state")
      .eq("facility_id", facilityId)
      .order("name");
  }

  async getNursingHomes() {
    return await this.supabase
      .from("nursing_homes")
      .select("id, name, us_state")
      .order("name");
  }
  
}