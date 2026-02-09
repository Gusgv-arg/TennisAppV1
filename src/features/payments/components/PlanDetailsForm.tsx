import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <View style={styles.container}>
            <Input
                label="Nombre del Plan"
                placeholder="Ej: Clase Individual, 8 Clases/Mes"
                value={name}
                onChangeText={onChangeName}
            />

            <Text style={styles.formLabel}>Tipo de Plan</Text>
            <View style={styles.typeSelector}>
                {['monthly', 'per_class'].map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[
                            styles.typeButton,
                            type === t && styles.typeButtonActive
                        ]}
                        onPress={() => onChangeType(t as PricingPlanType)}
                    >
                        <Text style={[
                            styles.typeButtonText,
                            type === t && styles.typeButtonTextActive
                        ]}>
                            {t === 'monthly' ? 'Mensual' : 'Por Clase'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.helperText}>
                {type === 'monthly'
                    ? 'Mensual: La deuda del alumno se devengará a fin de mes.'
                    : 'Por Clase: La deuda se devengará a partir del día que se tomó la clase.'}
            </Text>

            <Input
                label="Descripción (Opcional)"
                placeholder="Detalles del plan..."
                value={description}
                onChangeText={onChangeDescription}
                multiline
                numberOfLines={3}
                inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            {!hideButton && onSave && (
                <Button
                    label="Guardar"
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
