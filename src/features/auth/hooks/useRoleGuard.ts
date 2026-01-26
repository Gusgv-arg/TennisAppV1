import { useAuthStore } from '@/src/store/useAuthStore';
import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Hook to enforce role-based access control
 * Blocks students from accessing the app and provides role information
 */
export const useRoleGuard = () => {
    const { user } = useAuthStore();

    useEffect(() => {
        // Block students from accessing the app
        if (user?.role === 'student') {
            router.replace('/access-denied');
        }
    }, [user?.role]);

    return {
        isCoach: user?.role === 'coach',
        isStudent: user?.role === 'student',
        role: user?.role,
    };
};
