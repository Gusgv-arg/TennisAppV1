// Types for class groups (group sessions)

export interface ClassGroup {
    id: string;
    coach_id: string;
    academy_id?: string | null; // Multi-academy support
    name: string;
    description?: string | null;
    image_url?: string | null;
    plan_id?: string | null;
    is_active: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    // Relations
    plan?: {
        id: string;
        name: string;
        type: string;
    };
    members?: ClassGroupMember[];
    member_count?: number;
}

export interface ClassGroupMember {
    group_id: string;
    player_id: string;
    joined_at: string;
    // Relations
    player?: {
        id: string;
        full_name: string;
    };
    plan_id?: string | null;
    plan?: {
        id: string;
        name: string;
    };
    is_plan_exempt?: boolean;
}

export interface GroupMemberInput {
    player_id: string;
    plan_id: string | null;
    is_plan_exempt?: boolean;
}

export interface CreateClassGroupInput {
    name: string;
    description?: string;
    image_url?: string | null;
    plan_id?: string | null;
    member_ids?: string[]; // Deprecated: simple ID list, kept for back-compat
    members?: GroupMemberInput[]; // New: list of objects with config
    academy_id?: string | null;
}

export interface UpdateClassGroupInput {
    name?: string;
    description?: string | null;
    image_url?: string | null;
    plan_id?: string | null; // Deprecated
    is_active?: boolean;
    member_ids?: string[]; // Deprecated
    members?: GroupMemberInput[]; // New
}
