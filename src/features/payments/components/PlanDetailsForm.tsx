import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PricingPlanType } from '@/src/types/payments';

interface PlanDetailsFormProps {
    name: string;
    description: string;
    type: PricingPlanType;
    packageClasses?: string;
    onChangeName: (text: string) => void;
    onChangeDescription: (text: string) => void;
    onChangeType: (type: PricingPlanType) => void;
    onChangePackageClasses: (text: string) => void;
    onSave?: () => void;
    isLoading?: boolean;
    hideButton?: boolean;
}

export const PlanDetailsForm = ({
    name,
    description,
    type,
    packageClasses,
    onChangeName,
    onChangeDescription,
    onChangeType,
    onChangePackageClasses,
    onSave,
    isLoading,
    hideButton
}: PlanDetailsFormProps) => {
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

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    formLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
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
        backgroundColor: colors.neutral[100],
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    typeButtonActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[600],
        borderWidth: 2,
    },
    typeButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    typeButtonTextActive: {
        color: colors.common.white,
        fontWeight: '700',
    },
    helperText: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginBottom: spacing.sm,
        marginTop: -8, // Pull closer to the selector
        marginLeft: 4,
    },
});
