import { UserRole, UserStatus } from './enums'

export interface User {
  id: string
  email: string
  created_at: string
  updated_at?: string
  status: UserStatus
}

export interface UserRoleAssignment {
  user_id: string
  facility_id: string
  role: UserRole
  created_at: string
  created_by?: string
}

export interface User {
  id: string;
  email: string;
  status: UserStatus;
  created_at: string;
}

export interface UserRoleWithUser {
  id:string;
  user_id: string;
  role: string;
  facility_id: string;
  created_at: string;
  users: User[] | User;
}


export interface UserWithRole extends User {
  user_roles: UserRoleAssignment[]
}

export interface Facility {
  id: string
  name: string
  logo_url?: string | null
}

export interface AuditLog {
  id: string
  user_id: string
  action_type: string
  entity_type: string
  entity_id: string
  details: Record<string, any>
  created_at: string
  facility_id?: string
}

export interface NursingHome{
id: string;
name: string;
facility_id: string;
address: string;
} 

export interface SerializableUser {
    uid: string
    email: string
    emailVerified: boolean
    displayName: string
    photoURL: string
    phoneNumber: string
    metadata: {
        creationTime?: string
        lastSignInTime?: string
    }
}
