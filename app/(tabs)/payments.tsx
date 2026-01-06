import PaymentsOnboarding from '@/src/features/payments/components/PaymentsOnboarding';
import PaymentsScreen from '@/src/features/payments/components/PaymentsScreen';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';

export default function PaymentsTab() {
    const { isEnabled } = usePaymentSettings();

    if (!isEnabled) {
        return <PaymentsOnboarding />;
    }

    return <PaymentsScreen />;
}
