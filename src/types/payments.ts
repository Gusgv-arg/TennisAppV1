// Tipos para el sistema de pagos

export type PricingPlanType = 'monthly' | 'per_class' | 'package' | 'custom';

export type TransactionType = 'payment' | 'charge' | 'adjustment' | 'refund';

export type PaymentMethod = 'cash' | 'transfer' | 'mercadopago' | 'card' | 'other';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface PricingPlan {
    id: string;
    coach_id: string;
    name: string;
    type: PricingPlanType;
    amount: number;
    currency: string;
    package_classes?: number | null;
    description?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlayerSubscription {
    id: string;
    player_id: string;
    plan_id?: string | null;
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
    type: TransactionType;
    amount: number;
    currency: string;
    payment_method?: PaymentMethod | null;
    description?: string | null;
    reference?: string | null;
    transaction_date: string;
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
}

// Input types para crear/editar
export interface CreateTransactionInput {
    player_id: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    payment_method?: PaymentMethod;
    description?: string;
    reference?: string;
    transaction_date?: string;
}

export interface CreatePricingPlanInput {
    name: string;
    type: PricingPlanType;
    amount: number;
    currency?: string;
    package_classes?: number;
    description?: string;
}
