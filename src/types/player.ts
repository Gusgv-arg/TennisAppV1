export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type DominantHand = 'left' | 'right' | 'ambidextrous';

export interface Player {
    id: string;
    coach_id: string; // ID del coach propietario
    full_name: string;
    birth_date?: string | null;
    level?: PlayerLevel | null;
    dominant_hand?: DominantHand | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
    avatar_url?: string | null;
    is_archived: boolean;
    is_deleted: boolean;
    intended_role: 'coach' | 'collaborator' | 'player'; // Rol que tendrá cuando se registre
    created_at: string;
    updated_at: string;
}

export type CreatePlayerInput = Omit<Player, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'is_archived'>;
export type UpdatePlayerInput = Partial<CreatePlayerInput>;
