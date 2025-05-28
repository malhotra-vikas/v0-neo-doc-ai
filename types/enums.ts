export enum UserRole {
  SUPER_ADMIN = 'superadmin',
  FACILITY_ADMIN = 'facility_admin',
  FACILITY_USER = 'facility_user',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked'
}

export enum AuditActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  INVITE = 'invite',
  RECOVERY='recovery'
}

export enum EntityType {
  USER = 'user',
  FACILITY = 'facility',
  DOCUMENT = 'document',
  PDF = 'pdf'
}