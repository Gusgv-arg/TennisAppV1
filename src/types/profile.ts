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

    // Metadatos
    created_at: string;
    updated_at: string;
}

export type UpdateProfileInput = Partial<Omit<Profile, 'id' | 'email' | 'role' | 'created_at' | 'updated_at'>>;
