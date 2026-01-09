import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocation } from '@/src/features/locations/hooks/useLocations';

export default function LocationDetailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: location, isLoading } = useLocation(id!);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    if (!location) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('locationNotFound')}</Text>
                <Button label={t('back')} onPress={() => router.back()} />
            </View>
        );
    }


    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('locationDetails') }} />
            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.headerCard} padding="lg">
                    <View style={styles.headerTop}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="location-outline" size={32} color={colors.primary[600]} />
                        </View>
                        <View style={styles.badgeContainer}>
                            {location.is_archived && (
                                <View style={[styles.badge, styles.archivedBadge]}>
                                    <Text style={styles.badgeText}>{t('archived')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={styles.name}>{location.name}</Text>
                    <View style={styles.addressContainer}>
                        <Ionicons name="map-outline" size={16} color={colors.neutral[500]} />
                        <Text style={styles.address}>{location.address || t('noAddress')}</Text>
                    </View>
                </Card>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('notes')}</Text>
                    <Card padding="md">
                        <Text style={styles.notesText}>{location.notes || t('noNotes')}</Text>
                    </Card>
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
    content: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.size.lg,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    headerCard: {
        backgroundColor: colors.common.white,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        flexDirection: 'row',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    archivedBadge: {
        backgroundColor: colors.neutral[100],
    },
    badgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.xs,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    address: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
    },
    section: {
        gap: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
        marginLeft: spacing.xs,
    },
    notesText: {
        fontSize: typography.size.md,
        color: colors.neutral[700],
        lineHeight: 22,
    },
});
