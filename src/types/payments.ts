// Tipos para el sistema de pagos

export type PricingPlanType = 'monthly' | 'per_class' | 'package' | 'custom';

export type TransactionType = 'payment' | 'charge' | 'adjustment' | 'refund';

export type PaymentMethod = 'cash' | 'transfer' | 'mercadopago' | 'card' | 'other';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface PricingPlanPrice {
    id: string;
    plan_id: string;
    amount: number;
    valid_from: string;
    created_at: string;
}

export interface PricingPlan {
    id: string;
    coach_id: string;
    academy_id?: string | null; // Multi-academy support
    name: string;
    type: PricingPlanType;
    amount: number;
    currency: string;
    package_classes?: number | null;
    description?: string | null;
    is_active: boolean;
    price_updated_at: string;
    created_at: string;
    updated_at: string;
    // Relaciones
    prices?: PricingPlanPrice[];
}

export interface PlayerSubscription {
    id: string;
    player_id: string;
    plan_id?: string | null;
    academy_id?: string | null; // Multi-academy support
    status: SubscriptionStatus;
    start_date: string;
    end_date?: string | null;
    remaining_classes?: number | null;
    custom_amount?: number | null;
    notes?: string | null;
    created_at: string;
    updated_at: string;
    // Relaciones
    plan?: PricingPlan;
}

export interface Transaction {
    id: string;
    player_id: string;
    subscription_id?: string | null;
    unified_payment_group_id?: string | null; // Pago unificado
    academy_id?: string | null; // Multi-academy support
    type: TransactionType;
    amount: number;
    currency: string;
    payment_method?: PaymentMethod | null;
    description?: string | null;
    transaction_date: string;
    billing_month?: number | null;
    billing_year?: number | null;
    created_at: string;
    created_by?: string | null;
}

export interface PlayerBalance {
    player_id: string;
    full_name: string;
    coach_id: string;
    balance: number;
    total_payments: number;
    last_payment_date?: string | null;
    unified_payment_group_id?: string | null; // Grupo de pago unificado
}

// Input types para crear/editar
export interface CreateTransactionInput {
    player_id: string;
    unified_payment_group_id?: string; // Para pagos unificados
    academy_id?: string | null; // Multi-academy: null = bolsa general (FIFO)
    type: TransactionType;
    amount: number;
    currency?: string;
    payment_method?: PaymentMethod;
    description?: string;
    transaction_date?: string;
    billing_month?: number;
    billing_year?: number;
}

export interface CreatePricingPlanInput {
    name: string;
    type: PricingPlanType;
    amount: number;
    currency?: string;
    package_classes?: number;
    description?: string;
    academy_id?: string | null; // Multi-academy support
}

// ============================================
// UNIFIED PAYMENT GROUPS (Pago Unificado)
// ============================================

export interface UnifiedPaymentGroupMember {
    id: string;
    full_name: string;
}

export interface UnifiedPaymentGroup {
    id: string;
    academy_id: string;
    name: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
    is_active: boolean;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    // Computed fields from view
    member_count?: number;
    members?: UnifiedPaymentGroupMember[];
    total_balance?: number;
}

export interface CreateUnifiedPaymentGroupInput {
    name: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    notes?: string;
}

export interface UpdateUnifiedPaymentGroupInput {
    name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    notes?: string;
    is_active?: boolean;
}

