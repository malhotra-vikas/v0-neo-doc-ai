import { SupabaseClient } from "@supabase/supabase-js";
import type { User, UserRoleAssignment } from "@/types";
import { UserRole } from "@/types/enums";

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
  async getUsersWithRole(
    facilityId: string | null,
    inviteUserRole?: UserRole | null,
    userId?: string | null
  ) {
    let query = this.supabase.from("user_roles").select(`
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
      query = query.eq("facility_id", facilityId);
    }

    if (userId) {
      query = query.neq("user_id", userId);
    }

    if (inviteUserRole) {
      query = query.eq("role", inviteUserRole);
    }

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
      .select("*")
      .eq("facility_id", facilityId)
      .order("name");
  }

  async getNursingHomes() {
    return await this.supabase.from("nursing_homes").select("*").order("name");
  }

  async getUserRoleByUserId(userId: string) {
    return await this.supabase
      .from("user_roles")
      .select("role,facility_id")
      .eq("user_id", userId)
      .maybeSingle();
  }

  async updateFacilityStatus(
    facilityId: string,
    isActive: boolean,
    userId: string
  ) {
    return await this.supabase
      .from("facilities")
      .update({ is_active: isActive, updated_by: userId })
      .eq("id", facilityId);
  }

  async getUserStatusByEmail(email: string) {
    return await this.supabase
      .from("users")
      .select("status")
      .eq("email", email)
      .single();
  }

  async checkFacilityNameExists(name: string, excludeFacilityId?: string) {
    let query = this.supabase.from("facilities").select("id").eq("name", name);

    if (excludeFacilityId) {
      query = query.neq("id", excludeFacilityId);
    }
    const { data, error } = await query.limit(1);

    if (error && error.code === "PGRST116") {
      return false;
    }

    if (error) {
      throw error;
    }

    if (data.length > 0) {
      return true;
    }
    return false;
  }

  async createFacility(data: {
    name: string;
    logo_url?: string;
    created_by: string;
  }) {
    return await this.supabase
      .from("facilities")
      .insert([
        {
          ...data,
          is_active: true,
          updated_by: data.created_by,
        },
      ]).select('*').maybeSingle();
  }

  async updateFacility(
    facilityId: string,
    data: {
      name?: string;
      logo_url?: string;
      updated_by: string;
    }
  ) {
    return await this.supabase
      .from("facilities")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facilityId);
  }

  async getFacilities() {
    return await this.supabase
      .from("facilities")
      .select(
        `
        *,
        user_roles (
          id
        ),
        created_by_user:users!facilities_created_by_fkey (
          email
        ),
        updated_by_user:users!facilities_updated_by_fkey (
          email
        )
      `
      )
      .order("created_at", { ascending: false });
  }

  async getUserRolePermissions(userId: string) {
    const { data: roleData } = await this.getUserRoleByUserId(userId);

    if (!roleData?.role) {
      return { data: null, error: new Error("No role found for user") };
    }

    return await this.supabase
      .from("role_permissions")
      .select(`
        role,
        permissions (
          resource,
          action
        )
      `)
      .eq("role", roleData.role);
  }
}
