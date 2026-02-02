import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

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
    variant?: 'list' | 'grid';
}

const SettingsSection = ({ title, description, icon, iconColor, onPress, disabled, variant = 'list' }: SettingsSectionProps) => {
    const isGrid = variant === 'grid';

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled} style={{ height: '100%' }}>
            <Card
                style={[
                    styles.sectionCard,
                    disabled && styles.sectionCardDisabled,
                    isGrid && styles.sectionCardGrid
                ]}
                padding="md"
                elevation={isGrid ? 'md' : 'sm'}
            >
                <View style={[styles.sectionContent, isGrid && styles.sectionContentGrid]}>
                    <View style={[
                        styles.iconContainer,
                        { backgroundColor: `${iconColor}15` },
                        isGrid && styles.iconContainerGrid
                    ]}>
                        <Ionicons name={icon} size={isGrid ? 38 : 24} color={iconColor} />
                    </View>
                    <View style={[styles.sectionText, isGrid && styles.sectionTextGrid]}>
                        <Text style={[styles.sectionTitle, isGrid && styles.textCenter]}>{title}</Text>
                        <Text style={[styles.sectionDescription, isGrid && styles.textCenter]}>{description}</Text>
                    </View>
                    {!isGrid && <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />}
                </View>
            </Card>
        </TouchableOpacity>
    );
};

export default function SettingsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const { isOwner } = usePermissions();
    const { width } = useWindowDimensions();

    const isDesktop = width >= 768;
    const numColumns = isDesktop ? 4 : 1;
    const gap = isDesktop ? spacing.xl : spacing.md;
    // We assume the ScrollView has padding: spacing.md
    const containerPadding = spacing.md * 2;
    // Limit content width for desktop to avoid huge cards
    const maxContentWidth = 1100;
    const availableWidth = Math.min(width - containerPadding, maxContentWidth);
    const totalGap = (numColumns - 1) * gap;
    const cardWidth = (availableWidth - totalGap) / numColumns;

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={{
                    width: isDesktop ? availableWidth : '100%',
                    alignSelf: 'center',
                    flexDirection: isDesktop ? 'row' : 'column',
                    flexWrap: 'wrap',
                    gap: gap,
                    alignItems: 'stretch'
                }}>
                    {/* Owner-only sections */}
                    {isOwner && (
                        <>
                            {/* Academias - Gestión multi-academia */}
                            <View style={{ width: cardWidth, aspectRatio: isDesktop ? 1.3 : undefined }}>
                                <SettingsSection
                                    title="Academias"
                                    description="Gestiona tus Academias"
                                    icon="business-outline"
                                    iconColor={colors.primary[500]}
                                    onPress={() => router.push('/academy' as any)}
                                    variant={isDesktop ? 'grid' : 'list'}
                                />
                            </View>

                            {/* Planes de Pago */}
                            <View style={{ width: cardWidth, aspectRatio: isDesktop ? 1.3 : undefined }}>
                                <SettingsSection
                                    title="Planes de Pago"
                                    description="Administra los planes de tus alumnos"
                                    icon="pricetags-outline"
                                    iconColor={colors.primary[500]}
                                    onPress={() => router.push('/plans' as any)}
                                    disabled={!paymentsEnabled}
                                    variant={isDesktop ? 'grid' : 'list'}
                                />
                            </View>

                            {/* Ubicaciones */}
                            <View style={{ width: cardWidth, aspectRatio: isDesktop ? 1.3 : undefined }}>
                                <SettingsSection
                                    title="Ubicaciones"
                                    description="Canchas y lugares donde das clases"
                                    icon="location-outline"
                                    iconColor={colors.primary[500]}
                                    onPress={() => router.push('/locations')}
                                    variant={isDesktop ? 'grid' : 'list'}
                                />
                            </View>

                            {/* Equipo */}
                            <View style={{ width: cardWidth, aspectRatio: isDesktop ? 1.3 : undefined }}>
                                <SettingsSection
                                    title="Equipo"
                                    description="Miembros de tu Academia"
                                    icon="people-outline"
                                    iconColor={colors.primary[500]}
                                    onPress={() => router.push('/team' as any)}
                                    variant={isDesktop ? 'grid' : 'list'}
                                />
                            </View>
                        </>
                    )}

                    {/* Mi Perfil - Available to everyone */}
                    <View style={{ width: cardWidth, aspectRatio: isDesktop ? 1.3 : undefined }}>
                        <SettingsSection
                            title="Mi Perfil"
                            description="Tu información personal"
                            icon="person-outline"
                            iconColor={colors.primary[500]}
                            onPress={() => router.push('/profile')}
                            variant={isDesktop ? 'grid' : 'list'}
                        />
                    </View>
                </View>
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
        marginBottom: 0, // Handled by gap in container
        height: '100%',
    },
    sectionCardGrid: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        paddingTop: 0,
        paddingBottom: spacing.xl,
    },
    sectionCardDisabled: {
        opacity: 0.5,
    },
    sectionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionContentGrid: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    iconContainerGrid: {
        width: 64,
        height: 64,
        borderRadius: 16,
        marginRight: 0,
        marginBottom: spacing.md,
    },
    sectionText: {
        flex: 1,
    },
    sectionTextGrid: {
        flex: 0,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: 2,
    },
    textCenter: {
        textAlign: 'center',
    },
    sectionDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
});
