export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type SessionType = 'individual' | 'group' | 'match';

export interface Session {
    id: string;
    coach_id: string;
    player_id: string | null; // Keep for compatibility with existing records during transition
    scheduled_at: string; // ISO timestamptz
    duration_minutes: number;
    location: string | null;
    court: string | null;
    instructor_id: string | null;
    session_type: SessionType | null;
    status: SessionStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;

    // Joined data
    player?: {
        full_name: string;
        avatar_url: string | null;
    } | null;
    players?: Array<{
        id: string;
        full_name: string;
        avatar_url: string | null;
    }>;
    instructor?: {
        id: string;
        full_name: string;
    } | null;
    coach?: {
        full_name: string;
    } | null;
}

export interface CreateSessionInput extends Omit<Session, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'player' | 'players'> {
    player_ids?: string[];
}
export type UpdateSessionInput = Partial<CreateSessionInput>;
