// Types for class groups (group sessions)

export interface ClassGroup {
    id: string;
    coach_id: string;
    name: string;
    description?: string | null;
    plan_id?: string | null;
    is_active: boolean;
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
}

export interface CreateClassGroupInput {
    name: string;
    description?: string;
    plan_id?: string | null;
    member_ids?: string[];
}

export interface UpdateClassGroupInput {
    name?: string;
    description?: string | null;
    plan_id?: string | null;
    is_active?: boolean;
    member_ids?: string[];
}
