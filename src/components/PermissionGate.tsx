import React from 'react';

import { usePermissions } from '@/src/hooks/usePermissions';
import { AcademyRole, Permission } from '@/src/types/academy';

interface PermissionGateProps {
    /** Single permission to check */
    permission?: Permission;
    /** Multiple permissions - user must have at least one */
    anyOf?: Permission[];
    /** Multiple permissions - user must have all */
    allOf?: Permission[];
    /** Allowed roles */
    roles?: AcademyRole[];
    /** Content to render if permission is granted */
    children: React.ReactNode;
    /** Content to render if permission is denied (optional) */
    fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * // Single permission
 * <PermissionGate permission="players.create">
 *   <Button label="Nuevo Alumno" />
 * </PermissionGate>
 * 
 * @example
 * // Any of multiple permissions
 * <PermissionGate anyOf={['payments.view_all', 'payments.view_own']}>
 *   <PaymentsSection />
 * </PermissionGate>
 * 
 * @example
 * // Specific roles
 * <PermissionGate roles={['owner']}>
 *   <AdminPanel />
 * </PermissionGate>
 * 
 * @example
 * // With fallback
 * <PermissionGate 
 *   permission="players.edit" 
 *   fallback={<Text>No tienes permiso para editar</Text>}
 * >
 *   <EditForm />
 * </PermissionGate>
 */
export function PermissionGate({
    permission,
    anyOf,
    allOf,
    roles,
    children,
    fallback = null,
}: PermissionGateProps): React.ReactElement | null {
    const { can, canAny, canAll, role, isLoading } = usePermissions();

    // Still loading - don't render anything
    if (isLoading) {
        return null;
    }

    let hasAccess = false;

    // Check single permission
    if (permission) {
        hasAccess = can(permission);
    }
    // Check any of multiple permissions
    else if (anyOf && anyOf.length > 0) {
        hasAccess = canAny(anyOf);
    }
    // Check all of multiple permissions
    else if (allOf && allOf.length > 0) {
        hasAccess = canAll(allOf);
    }
    // Check role-based access
    else if (roles && roles.length > 0) {
        hasAccess = role !== null && roles.includes(role);
    }
    // No conditions specified - allow access
    else {
        hasAccess = true;
    }

    if (!hasAccess) {
        return fallback as React.ReactElement | null;
    }

    return <>{children}</>;
}

/**
 * Higher-order component version of PermissionGate
 */
export function withPermission<P extends object>(
    permission: Permission,
    Component: React.ComponentType<P>,
    FallbackComponent?: React.ComponentType<P>
) {
    return function WrappedComponent(props: P) {
        return (
            <PermissionGate
                permission={permission}
                fallback={FallbackComponent ? <FallbackComponent {...props} /> : null}
            >
                <Component {...props} />
            </PermissionGate>
        );
    };
}

/**
 * Hook-based alternative for use in event handlers and imperative code
 * 
 * @example
 * const { guardAction } = usePermissionGuard();
 * 
 * const handleDelete = () => {
 *   guardAction('players.archive', () => {
 *     // Delete logic here
 *   }, () => {
 *     alert('No tienes permiso');
 *   });
 * };
 */
export function usePermissionGuard() {
    const { can } = usePermissions();

    const guardAction = (
        permission: Permission,
        action: () => void,
        onDenied?: () => void
    ) => {
        if (can(permission)) {
            action();
        } else if (onDenied) {
            onDenied();
        }
    };

    return { guardAction };
}
