export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'coach' | 'collaborator' | 'player';

    // Ubicación Geográfica
    country?: string | null;
    state_province?: string | null;
    city?: string | null;
    postal_code?: string | null;

    // Contacto
    phone?: string | null;

    // Personal
    bio?: string | null;
    avatar_url?: string | null;

    // Beta Testing
    onboarding_completed?: boolean;
    last_active_at?: string | null;
    beta_feedback_count?: number;
    beta_joined_at?: string | null;

    // Payments
    payments_enabled?: boolean;
    payments_simplified?: boolean;
    payments_enabled_at?: string | null;

    // Academy (multi-tenant)
    current_academy_id?: string | null;

    // Subscription (user-level)
    subscription_tier?: SubscriptionTier;
    subscription_status?: SubscriptionStatus;
    subscription_started_at?: string;
    subscription_ends_at?: string | null;

    // Account Deletion
    deletion_requested_at?: string | null;
    deletion_scheduled_at?: string | null;

    // Metadatos
    created_at: string;
    updated_at: string;
}

export type SubscriptionTier = 'beta_free' | 'basic' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';

export type UpdateProfileInput = Partial<Omit<Profile, 'id' | 'email' | 'role' | 'created_at' | 'updated_at'>>;
