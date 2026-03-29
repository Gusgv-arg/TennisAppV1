import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { PricingPlanType } from '@/src/types/payments';

interface PlanDetailsFormProps {
    name: string;
    description: string;
    type: PricingPlanType;
    onChangeName: (text: string) => void;
    onChangeDescription: (text: string) => void;
    onChangeType: (type: PricingPlanType) => void;
    onSave?: () => void;
    isLoading?: boolean;
    hideButton?: boolean;
}

export const PlanDetailsForm = ({
    name,
    description,
    type,
    onChangeName,
    onChangeDescription,
    onChangeType,
    onSave,
    isLoading,
    hideButton
}: PlanDetailsFormProps) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <View style={styles.container}>
            <Input
                label={t('pricingPlans.modals.detailsForm.nameLabel')}
                placeholder={t('pricingPlans.modals.detailsForm.namePlaceholder')}
                value={name}
                onChangeText={onChangeName}
            />

            <Text style={styles.formLabel}>{t('pricingPlans.modals.detailsForm.typeLabel')}</Text>
            <View style={styles.typeSelector}>
                {['monthly', 'per_class'].map((planType) => (
                    <TouchableOpacity
                        key={planType}
                        style={[
                            styles.typeButton,
                            type === planType && styles.typeButtonActive
                        ]}
                        onPress={() => onChangeType(planType as PricingPlanType)}
                    >
                        <Text style={[
                            styles.typeButtonText,
                            type === planType && styles.typeButtonTextActive
                        ]}>
                            {planType === 'monthly' ? t('pricingPlans.modals.detailsForm.types.monthly') : t('pricingPlans.modals.detailsForm.types.per_class')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.helperText}>
                {type === 'monthly'
                    ? t('pricingPlans.modals.detailsForm.helpers.monthly')
                    : t('pricingPlans.modals.detailsForm.helpers.per_class')}
            </Text>

            {!hideButton && onSave && (
                <Button
                    label={t('save')}
                    onPress={onSave}
                    loading={isLoading}
                    variant="primary"
                    style={{ marginTop: spacing.md }}
                />
            )}
        </View>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    formLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: theme.text.secondary,
        marginBottom: -8,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    typeButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    typeButtonActive: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
        borderWidth: 2,
    },
    typeButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.secondary,
    },
    typeButtonTextActive: {
        color: 'white',
        fontWeight: '700',
    },
    helperText: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginBottom: spacing.sm,
        marginTop: -8, // Pull closer to the selector
        marginLeft: 4,
    },
});
