export interface Location {
    id: string;
    coach_id: string;
    name: string;
    address?: string | null;
    notes?: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

export type CreateLocationInput = Omit<Location, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'is_archived'>;
export type UpdateLocationInput = Partial<CreateLocationInput>;
