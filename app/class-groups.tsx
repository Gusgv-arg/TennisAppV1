import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';

import GroupModal from '@/src/components/GroupModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { ClassGroup } from '@/src/types/classGroups';

export default function ClassGroupsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const params = useLocalSearchParams<{ create?: string; edit?: string; view?: string }>();
    const { data: groups, isLoading } = useClassGroups();
    const { data: players } = usePlayers();
    const { plans } = usePricingPlans();

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');

    // Handle Deep Linking
    useEffect(() => {
        if (params.create === 'true') {
            setModalMode('create');
            setSelectedGroupId(null);
            setModalVisible(true);
        } else if (params.edit) {
            setModalMode('edit');
            setSelectedGroupId(params.edit);
            setModalVisible(true);
        } else if (params.view) {
            setModalMode('view');
            setSelectedGroupId(params.view);
            setModalVisible(true);
        }
    }, [params.create, params.edit, params.view]);

    const handleCreate = () => {
        setModalMode('create');
        setSelectedGroupId(null);
        setModalVisible(true);
    };

    const handleEdit = (group: ClassGroup) => {
        setModalMode('edit');
        setSelectedGroupId(group.id);
        setModalVisible(true);
    };

    const handleView = (group: ClassGroup) => {
        setModalMode('view');
        setSelectedGroupId(group.id);
        setModalVisible(true);
    };

    const handleCloseModal = () => {
        setModalVisible(false);
        // Clear params if present to avoid reopening on refresh/back
        if (params.create || params.edit || params.view) {
            if (router.canGoBack()) router.back();
            else router.setParams({ create: undefined, edit: undefined, view: undefined });
        }
    };

    const renderGroupItem = ({ item }: { item: ClassGroup }) => {
        // Calculate effective plans for all members
        const effectivePlans = new Set(item.members?.map(m => {
            if (m.is_plan_exempt) return 'IS_EXEMPT';
            return m.plan_id || item.plan_id || 'NO_PLAN';
        }));

        const hasMixedPlans = effectivePlans.size > 1;

        const memberNames = item.members
            ?.map(m => players?.find(p => p.id === m.player_id)?.full_name)
            .filter(Boolean)
            .join(', ');

        return (
            <TouchableOpacity onPress={() => handleView(item)} activeOpacity={0.7}>
                <Card style={styles.groupCard} padding="md">
                    <View style={styles.groupHeader}>
                        <View style={[styles.groupIcon, item.image_url ? { backgroundColor: 'transparent' } : null]}>
                            {item.image_url ? (
                                <Avatar source={item.image_url} name={item.name} size="md" />
                            ) : (
                                <Ionicons name="people" size={24} color={theme.text.secondary} />
                            )}
                        </View>
                        <View style={styles.groupInfo}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.groupName}>{item.name}</Text>
                                <TouchableOpacity onPress={() => handleEdit(item)} hitSlop={10}>
                                    <Ionicons name="create-outline" size={20} color={theme.components.button.primary.bg} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.groupMeta} numberOfLines={1}>
                                {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                {item.plan ? ` • ${item.plan.name}` : ''}
                            </Text>

                            {/* Conditional Member Display */}
                            {hasMixedPlans ? (
                                <View style={{ marginTop: 2 }}>
                                    {item.members?.map(m => {
                                        const player = players?.find(p => p.id === m.player_id);
                                        if (!player) return null;

                                        let planLabel = 'Plan del Grupo';
                                        let labelColor = theme.text.secondary;

                                        if (m.is_plan_exempt) {
                                            planLabel = 'Excluído del cobro';
                                            labelColor = theme.status.error;
                                        } else if (m.plan_id) {
                                            planLabel = plans?.find(p => p.id === m.plan_id)?.name || 'Custom';
                                            labelColor = theme.components.button.primary.bg;
                                        }

                                        return (
                                            <View key={m.player_id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="person-outline" size={12} color={theme.text.tertiary} style={{ marginRight: 4 }} />
                                                <Text style={[styles.groupMemberDetailedText, { marginRight: 8, marginTop: 0 }]}>
                                                    {player.full_name}
                                                </Text>
                                                <Ionicons name={m.is_plan_exempt ? "alert-circle-outline" : "pricetag-outline"} size={12} color={labelColor} style={{ marginRight: 4 }} />
                                                <Text style={{ fontSize: 11, color: labelColor }}>
                                                    {planLabel}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                memberNames ? (
                                    <Text style={styles.groupMembersText} numberOfLines={1}>
                                        {memberNames}
                                    </Text>
                                ) : null
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };



    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Grupos' }} />

            <FlatList
                data={groups}
                renderItem={renderGroupItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="people-outline" size={32} color={theme.text.tertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No hay grupos</Text>
                            <Text style={styles.emptyText}>Crea grupos para agendar clases rápidamente.</Text>
                        </View>
                    ) : null
                }
            />

            <TouchableOpacity style={styles.fab} onPress={handleCreate} activeOpacity={0.8}>
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>

            <GroupModal
                visible={modalVisible}
                onClose={handleCloseModal}
                groupId={selectedGroupId}
                mode={modalMode}
            />
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    groupCard: {
        marginBottom: spacing.md,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: theme.components.button.primary.bg + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: theme.text.primary,
        marginBottom: 2,
    },
    groupMeta: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
    },
    groupMembersText: {
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
        marginTop: 2,
    },
    groupMemberDetailedText: {
        fontSize: typography.size.xs,
        color: theme.text.primary,
        marginTop: 2,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.lg,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.components.button.primary.bg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.components.button.primary.bg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    emptyText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        marginTop: 4,
    },
});
