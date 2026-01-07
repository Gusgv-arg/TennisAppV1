import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCollaborator } from '@/src/features/collaborators/hooks/useCollaborators';

export default function CollaboratorDetailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: collaborator, isLoading } = useCollaborator(id!);

    if (isLoading || !collaborator) {
        return (
            <View style={styles.loadingContainer}>
                <Text>{t('loading')}...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: t('collaboratorDetails'),
                headerTitleAlign: 'center',
            }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Avatar name={collaborator.full_name} source={undefined} size="xl" />
                    <View style={styles.headerInfo}>
                        <Text style={styles.name}>{collaborator.full_name}</Text>
                        <Text style={styles.role}>{t('collaborator')}</Text>
                    </View>
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t('collaborators')}</Text>
                        </View>
                        {!collaborator.is_active && (
                            <View style={[styles.badge, styles.archivedBadge]}>
                                <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <Card style={styles.infoCard} padding="md">
                    <DetailItem label={t('email')} value={collaborator.email || '-'} icon="mail-outline" />
                    <DetailItem label={t('phone')} value={collaborator.phone || '-'} icon="call-outline" />
                </Card>

                {collaborator.notes && (
                    <Card style={styles.notesCard} padding="md">
                        <Text style={styles.sectionTitle}>{t('notes')}</Text>
                        <Text style={styles.notesText}>{collaborator.notes}</Text>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
}

const DetailItem = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
    <View style={styles.detailItem}>
        <View style={styles.iconContainer}>
            <Ionicons name={icon} size={20} color={colors.primary[500]} />
        </View>
        <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: spacing.md,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
    },
    headerInfo: {
        alignItems: 'center',
        marginTop: spacing.md,
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    role: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: 2,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    badge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
    },
    archivedBadge: {
        backgroundColor: colors.neutral[200],
    },
    badgeText: {
        color: colors.primary[700],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    archivedBadgeText: {
        color: colors.neutral[600],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    infoCard: {
        marginBottom: spacing.md,
    },
    notesCard: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    notesText: {
        fontSize: typography.size.md,
        color: colors.neutral[800],
        lineHeight: 22,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        fontWeight: '500',
    },
    detailValue: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
        fontWeight: '600',
    },
});
