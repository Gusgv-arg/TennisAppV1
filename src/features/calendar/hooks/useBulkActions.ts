import { useMemo, useState } from 'react';
import { useSessions } from './useSessions';

// Native Date Helpers
const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

export interface BulkFilters {
    startDate: Date;
    endDate: Date;
    playerIds: string[];
    groupId: string | null;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, ...
}

export const useBulkActions = () => {
    // Default range: Today to +1 Month
    const [filters, setFilters] = useState<BulkFilters>({
        startDate: startOfDay(new Date()),
        endDate: endOfDay(addMonths(new Date(), 1)),
        playerIds: [],
        groupId: null,
        daysOfWeek: [] // Empty means ALL
    });

    // We fetch sessions for the date range
    // useSessions expects ISO strings
    const { data: allSessions, isLoading, error, refetch } = useSessions(
        filters.startDate.toISOString(),
        filters.endDate.toISOString()
    );

    const filteredSessions = useMemo(() => {
        if (!allSessions) return [];

        return allSessions.filter(session => {
            const sessionDate = new Date(session.scheduled_at);

            // 1. Day of Week Filter
            if (filters.daysOfWeek.length > 0) {
                const day = sessionDate.getDay();
                if (!filters.daysOfWeek.includes(day)) return false;
            }

            // 2. Group Filter
            if (filters.groupId) {
                // Check if session belongs to this group.
                // Note: 'class_group' property comes from the query in useSessions but might not be in strict Session type.
                // We rely on the runtime shape here.
                const sessionGroupId = (session as any).class_group?.id;
                if (sessionGroupId !== filters.groupId) return false;
            }

            // 3. Player Filter
            // If any of the selected players are in the session
            if (filters.playerIds.length > 0) {
                // Ensure players exists (fallback to empty array)
                const sessionPlayerIds = session.players?.map(p => p.id) || [];
                const hasPlayer = filters.playerIds.some(id => sessionPlayerIds.includes(id));
                if (!hasPlayer) return false;
            }

            return true;
        });
    }, [allSessions, filters]);

    // Helpers to update specific filters
    const updateFilter = (key: keyof BulkFilters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return {
        filters,
        setFilters,
        updateFilter,
        sessions: filteredSessions,
        isLoading,
        error,
        refetch,
        totalFound: filteredSessions.length,
        totalInPeriod: allSessions?.length || 0
    };
};
