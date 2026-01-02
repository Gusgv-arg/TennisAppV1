export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type SessionType = 'individual' | 'group' | 'match';

export interface Session {
    id: string;
    coach_id: string;
    player_id: string | null;
    scheduled_at: string; // ISO timestamptz
    duration_minutes: number;
    location: string | null;
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
}

export type CreateSessionInput = Omit<Session, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'player'>;
export type UpdateSessionInput = Partial<CreateSessionInput>;
