import { useCallback, useMemo } from 'react';

import { useCurrentAcademyMember } from '@/src/features/academy/hooks/useAcademy';
import { AcademyRole, Permission, ROLE_PERMISSIONS } from '@/src/types/academy';

interface UsePermissionsReturn {
    /** Check if user has a specific permission */
    can: (permission: Permission) => boolean;
    /** Check if user has any of the specified permissions */
    canAny: (permissions: Permission[]) => boolean;
    /** Check if user has all of the specified permissions */
    canAll: (permissions: Permission[]) => boolean;
    /** Current user's role */
    role: AcademyRole | null;
    /** Is the user the owner? */
    isOwner: boolean;
    /** Is the user a coach or higher? */
    isCoachOrHigher: boolean;
    /** Is checking permissions still loading? */
    isLoading: boolean;
    /** Does user have any academy membership? */
    hasMembership: boolean;
}

/**
 * Hook for checking user permissions in the current academy
 * 
 * @example
 * const { can, isOwner, role } = usePermissions();
 * 
 * if (can('players.create')) {
 *   // Show create button
 * }
 * 
 * if (isOwner) {
 *   // Show admin features
 * }
 */
export function usePermissions(): UsePermissionsReturn {
    const { data: member, isLoading } = useCurrentAcademyMember();

    const role = member?.role ?? null;

    const can = useCallback((permission: Permission): boolean => {
        if (!member || !member.role) return false;

        // Check custom permissions first (overrides)
        if (member.custom_permissions && permission in member.custom_permissions) {
            return member.custom_permissions[permission];
        }

        // Check role-based permissions
        const rolePermissions = ROLE_PERMISSIONS[member.role];
        return rolePermissions.includes(permission);
    }, [member]);

    const canAny = useCallback((permissions: Permission[]): boolean => {
        return permissions.some(p => can(p));
    }, [can]);

    const canAll = useCallback((permissions: Permission[]): boolean => {
        return permissions.every(p => can(p));
    }, [can]);

    const isOwner = useMemo(() => role === 'owner', [role]);

    const isCoachOrHigher = useMemo(() => {
        return role === 'owner' || role === 'coach';
    }, [role]);

    const hasMembership = useMemo(() => !!member, [member]);

    return {
        can,
        canAny,
        canAll,
        role,
        isOwner,
        isCoachOrHigher,
        isLoading,
        hasMembership,
    };
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: AcademyRole): string {
    const names: Record<AcademyRole, string> = {
        owner: 'Dueño',
        coach: 'Profesor',
        assistant: 'Asistente',
        viewer: 'Observador',
    };
    return names[role] || role;
}

/**
 * Get role color for badges
 */
export function getRoleColor(role: AcademyRole): { bg: string; text: string } {
    const colors: Record<AcademyRole, { bg: string; text: string }> = {
        owner: { bg: '#FEE2E2', text: '#991B1B' },      // Red
        coach: { bg: '#DCFCE7', text: '#166534' },      // Green
        assistant: { bg: '#DBEAFE', text: '#1E40AF' },  // Blue
        viewer: { bg: '#F3F4F6', text: '#4B5563' },     // Gray
    };
    return colors[role] || colors.viewer;
}
