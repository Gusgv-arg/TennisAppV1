import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocation } from '@/src/features/locations/hooks/useLocations';
import { useTheme } from '@/src/hooks/useTheme';

export default function LocationDetailScreen() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: location, isLoading } = useLocation(id!);

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
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
                            <Ionicons name="location-outline" size={32} color={theme.components.button.primary.bg} />
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
                        <Ionicons name="map-outline" size={16} color={theme.text.secondary} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
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
        color: theme.text.secondary,
        textAlign: 'center',
    },
    headerCard: {
        backgroundColor: theme.background.surface,
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
        backgroundColor: theme.components.button.primary.bg + '15',
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
        backgroundColor: theme.background.subtle,
    },
    badgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.tertiary,
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.text.primary,
        marginBottom: spacing.xs,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    address: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
    },
    section: {
        gap: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: theme.text.tertiary,
        marginLeft: spacing.xs,
    },
    notesText: {
        fontSize: typography.size.md,
        color: theme.text.primary,
        lineHeight: 22,
    },
});
