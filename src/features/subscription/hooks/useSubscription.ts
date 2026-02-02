import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { SubscriptionStatus, SubscriptionTier } from '@/src/types/profile';

/**
 * Hook to get subscription info for the current user.
 * Subscription is at the USER level, not academy level.
 * - beta_free: Full access during beta
 * - basic: 1 academy
 * - pro: Multi-academy + AI features
 */
export function useSubscription() {
    const { data: profile, isLoading, error } = useProfile();

    const tier: SubscriptionTier = profile?.subscription_tier || 'beta_free';
    const status: SubscriptionStatus = profile?.subscription_status || 'active';

    return {
        // Raw data
        tier,
        status,
        isLoading,
        error,

        // Helper properties
        isBeta: tier === 'beta_free',
        isBasic: tier === 'basic',
        isPro: tier === 'pro',
        isActive: status === 'active' || status === 'trialing',
        isPastDue: status === 'past_due',

        // Feature access helpers
        canCreateMultipleAcademies: tier === 'beta_free' || tier === 'pro',
        maxAcademies: tier === 'basic' ? 1 : Infinity,

        // Display helpers
        tierLabel: getTierLabel(tier),
        statusLabel: getStatusLabel(status),
    };
}

function getTierLabel(tier: SubscriptionTier): string {
    switch (tier) {
        case 'beta_free':
            return 'Beta Gratuito';
        case 'basic':
            return 'Básico';
        case 'pro':
            return 'Pro';
        default:
            return tier;
    }
}

function getStatusLabel(status: SubscriptionStatus): string {
    switch (status) {
        case 'active':
            return 'Activo';
        case 'trialing':
            return 'Prueba';
        case 'past_due':
            return 'Pago pendiente';
        case 'canceled':
            return 'Cancelado';
        case 'unpaid':
            return 'Impago';
        default:
            return status;
    }
}
