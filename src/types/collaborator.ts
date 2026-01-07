export interface Collaborator {
    id: string;
    coach_id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    is_active: boolean;
    profile_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateCollaboratorInput {
    full_name: string;
    email?: string;
    phone?: string;
    notes?: string;
}

export interface UpdateCollaboratorInput {
    full_name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    is_active?: boolean;
}
