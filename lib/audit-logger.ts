import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"

export type AuditActionType =
    | "login"
    | "logout"
    | "create"
    | "update"
    | "delete"
    | "view"
    | "download"
    | "upload"
    | "process"
    | "generate_report"

export type AuditEntityType =
    | "user"
    | "nursing_home"
    | "patient"
    | "patient_file"
    | "nursing_home_file"
    | "pdf_queue"
    | "report"

interface AuditLogParams {
    user: User
    actionType: AuditActionType
    entityType: AuditEntityType
    entityId?: string
    details?: Record<string, any>
}

export async function logAuditEvent({
    user,
    actionType,
    entityType,
    entityId,
    details = {},
}: AuditLogParams): Promise<void> {
    try {
        const supabase = createClientComponentClient()

        // Get client information
        const userAgent = navigator.userAgent

        // Log the audit event
        await supabase.rpc("add_audit_log", {
            p_user_id: user?.id,
            p_user_email: user?.email,
            p_action_type: actionType,
            p_entity_type: entityType,
            p_entity_id: entityId || null,
            p_details: details,
            p_ip_address: null, // IP address is best captured server-side
            p_user_agent: userAgent,
        })
    } catch (error) {
        console.error("Failed to log audit event:", error)
    }
}

// Server-side audit logging
export async function logServerAuditEvent(
    supabase: any,
    params: {
        userId: string
        userEmail: string
        actionType: AuditActionType
        entityType: AuditEntityType
        entityId?: string
        details?: Record<string, any>
        ipAddress?: string
        userAgent?: string
    },
): Promise<void> {
    try {
        await supabase.rpc("add_audit_log", {
            p_user_id: params.userId,
            p_user_email: params.userEmail,
            p_action_type: params.actionType,
            p_entity_type: params.entityType,
            p_entity_id: params.entityId || null,
            p_details: params.details || {},
            p_ip_address: params.ipAddress || null,
            p_user_agent: params.userAgent || null,
        })
    } catch (error) {
        console.error("Failed to log server audit event:", error)
    }
}
