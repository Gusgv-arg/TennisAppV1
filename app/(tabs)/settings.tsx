import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



import { AcademySwitcher } from '@/src/components/AcademySwitcher';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePermissions } from '@/src/hooks/usePermissions';

interface SettingsSectionProps {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    onPress: () => void;
    disabled?: boolean;
}

const SettingsSection = ({ title, description, icon, iconColor, onPress, disabled }: SettingsSectionProps) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
        <Card style={{ ...styles.sectionCard, ...(disabled ? styles.sectionCardDisabled : {}) }} padding="md">
            <View style={styles.sectionContent}>
                <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                    <Ionicons name={icon} size={24} color={iconColor} />
                </View>
                <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <Text style={styles.sectionDescription}>{description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </View>
        </Card>
    </TouchableOpacity>
);

export default function SettingsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const { isOwner } = usePermissions();

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Academia Switcher */}
                <AcademySwitcher />

                {/* Academias - Gestión multi-academia */}
                {isOwner && (
                    <SettingsSection
                        title="Academias"
                        description="Gestiona tus academias y crea nuevas"
                        icon="business-outline"
                        iconColor={colors.primary[500]}
                        onPress={() => router.push('/academy' as any)}
                    />
                )}

                {/* Planes de Pago */}
                <SettingsSection
                    title="Planes de Pago"
                    description="Crea y administra los planes para tus alumnos"
                    icon="pricetags-outline"
                    iconColor={colors.primary[500]}
                    onPress={() => router.push('/plans' as any)}
                    disabled={!paymentsEnabled && !isOwner}
                />

                {/* Ubicaciones */}
                <SettingsSection
                    title="Ubicaciones"
                    description="Canchas y lugares donde das clases"
                    icon="location-outline"
                    iconColor={colors.primary[500]}
                    onPress={() => router.push('/locations')}
                />

                {/* Equipo (antes Colaboradores) */}
                <SettingsSection
                    title="Equipo"
                    description="Miembros y colaboradores de tu academia"
                    icon="people-outline"
                    iconColor={colors.primary[500]}
                    onPress={() => router.push('/team' as any)}
                />

                {/* Mi Perfil */}
                <SettingsSection
                    title="Mi Perfil"
                    description="Tu información personal y preferencias"
                    icon="person-outline"
                    iconColor={colors.primary[500]}
                    onPress={() => router.push('/profile')}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    header: {
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.xs,
    },
    subheader: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginBottom: spacing.lg,
    },
    sectionCard: {
        marginBottom: spacing.sm,
    },
    sectionCardDisabled: {
        opacity: 0.5,
    },
    sectionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    sectionText: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: 2,
    },
    sectionDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
});
