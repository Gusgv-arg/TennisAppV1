export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type SessionType = 'individual' | 'group' | 'match';
export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'custom';

export interface RecurrenceConfig {
    frequency: RecurrenceFrequency;
    interval?: number;
    daysOfWeek?: number[]; // 0=Sunday...
    endDate?: Date;
    occurrences?: number;
}

export interface SessionAttendance {
    id: string;
    session_id: string;
    player_id: string;
    status: AttendanceStatus;
    notes: string | null;
    marked_at: string;
    marked_by: string | null;
}

export interface Session {
    id: string;
    coach_id: string;
    academy_id?: string | null; // Multi-academy support
    player_id: string | null; // Keep for compatibility with existing records during transition
    scheduled_at: string; // ISO timestamptz
    duration_minutes: number;
    location: string | null;
    court: string | null;
    instructor_id: string | null;
    session_type: SessionType | null;
    status: SessionStatus;
    notes: string | null;
    cancellation_reason?: string | null;
    deleted_at?: string | null;
    created_at: string;
    updated_at: string;
    recurrence_group_id?: string | null;

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
    // Attendance data
    attendance?: Array<{
        player_id: string;
        status: AttendanceStatus;
        notes: string | null;
    }>;
    // Class group data (for group sessions)
    class_group_id?: string | null;
    class_group_name?: string | null;
    class_group?: {
        id: string;
        name: string;
        image_url?: string | null;
    } | null;
    // Multi-academy data
    academy?: {
        id: string;
        name: string;
    } | null;
}

// Type for linking a player to a specific subscription when creating a session
export interface PlayerSubscriptionAssignment {
    player_id: string;
    subscription_id: string | null; // null if player has no plan
}

export interface CreateSessionInput extends Omit<Session, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'player' | 'players'> {
    player_ids?: string[];
    // NEW: Map each player to their subscription for billing
    player_subscriptions?: PlayerSubscriptionAssignment[];
    // Multi-academy: academy_id is inherited from Session, will be set during creation
}
export type UpdateSessionInput = Partial<CreateSessionInput>;

