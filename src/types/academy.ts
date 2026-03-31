// Academy types for multi-tenant system

export type AcademyRole = 'owner' | 'admin' | 'coach' | 'assistant' | 'viewer';

export type SubscriptionTier = 'beta_free' | 'basic' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
export interface Academy {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    settings: AcademySettings;
    is_archived?: boolean;
    created_by: string;
    subscription_tier?: SubscriptionTier;
    subscription_status?: SubscriptionStatus;
    subscription_started_at?: string;
    subscription_ends_at?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface AcademySettings {
    currency: string;
    timezone: string;
    payments_enabled: boolean;
    payments_simplified?: boolean;
    billing_enabled_at?: string;
}

export interface AcademyMember {
    id: string;
    academy_id: string;
    user_id: string | null; // null for registered-only members
    role: AcademyRole;
    custom_permissions: Record<string, boolean>;
    invited_by?: string | null;
    invited_at: string;
    accepted_at?: string | null;
    is_active: boolean;
    created_at: string;
    // New fields for registered staff
    member_name?: string | null;
    member_email?: string | null;
    has_app_access: boolean;
    // Joined fields
    academy?: Academy;
    user?: {
        id: string;
        email: string;
        full_name?: string;
        avatar_url?: string;
    } | null;
}

export interface AcademyInvitation {
    id: string;
    academy_id: string;
    email: string;
    role: AcademyRole;
    token: string;
    invited_by: string;
    expires_at: string;
    accepted_at?: string | null;
    created_at: string;
    // Joined fields
    academy?: Academy;
    inviter?: {
        full_name?: string;
        email: string;
    };
}

export interface CreateAcademyInput {
    name: string;
    slug?: string; // Auto-generated if not provided
    logo_url?: string;
}

export interface UpdateAcademyInput {
    name?: string;
    logo_url?: string;
    settings?: Partial<AcademySettings>;
}

export interface InviteMemberInput {
    email: string;
    role: Exclude<AcademyRole, 'owner'>; // Owners cannot be invited directly, only admins
}

export interface UpdateMemberInput {
    role?: Exclude<AcademyRole, 'owner'>; // Can change to any role except owner
    member_name?: string | null;
    member_email?: string | null;
    custom_permissions?: Record<string, boolean>;
    is_active?: boolean;
}

export interface RegisterMemberInput {
    member_name: string;
    member_email?: string;
    role: Exclude<AcademyRole, 'owner'>; // Can't register owners
}

// Permission types
export type Permission =
    // Players
    | 'players.view'
    | 'players.create'
    | 'players.edit'
    | 'players.archive'
    // Sessions
    | 'sessions.view'
    | 'sessions.create'
    | 'sessions.edit'
    | 'sessions.delete'
    // Locations
    | 'locations.view'
    | 'locations.manage'
    // Payments
    | 'payments.view_own'
    | 'payments.view_all'
    | 'payments.record'
    | 'payments.manage'
    // Plans
    | 'plans.view'
    | 'plans.manage'
    // Team
    | 'team.view'
    | 'team.manage'
    // Academy
    | 'academy.edit'
    | 'academy.delete';

// Role permission mappings
export const ROLE_PERMISSIONS: Record<AcademyRole, Permission[]> = {
    owner: [
        'players.view', 'players.create', 'players.edit', 'players.archive',
        'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
        'locations.view', 'locations.manage',
        'payments.view_own', 'payments.view_all', 'payments.record', 'payments.manage',
        'plans.view', 'plans.manage',
        'team.view', 'team.manage',
        'academy.edit', 'academy.delete',
    ],
    admin: [
        'players.view', 'players.create', 'players.edit', 'players.archive',
        'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
        'locations.view', 'locations.manage',
        'payments.view_own', 'payments.view_all', 'payments.record', 'payments.manage',
        'plans.view', 'plans.manage',
        'team.view', 'team.manage',
        'academy.edit',
    ],
    coach: [
        'players.view', 'players.create', 'players.edit', 'players.archive',
        'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
        'locations.view',
        'payments.view_own', 'payments.record',
        'plans.view',
        'team.view',
    ],
    assistant: [
        'players.view',
        'sessions.view', 'sessions.create', 'sessions.edit',
        'locations.view',
        'plans.view',
        'team.view',
    ],
    viewer: [
        'players.view',
        'sessions.view',
        'locations.view',
    ],
};
