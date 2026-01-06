export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'coach' | 'admin' | 'collaborator' | 'player';

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

    // Metadatos
    created_at: string;
    updated_at: string;
}

export type UpdateProfileInput = Partial<Omit<Profile, 'id' | 'email' | 'role' | 'created_at' | 'updated_at'>>;
