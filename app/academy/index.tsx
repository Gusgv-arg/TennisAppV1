import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations, useCurrentAcademy, useCurrentAcademyMember, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { Academy } from '@/src/types/academy';

export default function AcademiesScreen() {
    const router = useRouter();
    const { data: academiesData, isLoading } = useUserAcademies();
    const { data: currentAcademy } = useCurrentAcademy();
    const { data: currentMember } = useCurrentAcademyMember();
    const { archiveAcademy, unarchiveAcademy, switchAcademy } = useAcademyMutations();

    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: 'warning' | 'success' | 'info' | 'error';
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
    }>({
        type: 'info',
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // User can create academy if they are owner of any academy OR have no academies
    const allAcademies = [...(academiesData?.active || []), ...(academiesData?.archived || [])];
    const canCreateAcademy = !allAcademies.length || currentMember?.role === 'owner';

    // Filter by search and active/archived status
    const baseList = showArchived ? (academiesData?.archived || []) : (academiesData?.active || []);
    const filteredAcademies = baseList.filter(academy =>
        academy.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const archivedCount = academiesData?.archived?.length || 0;

    const handleArchivePress = (academy: Academy) => {
        setModalConfig({
            type: 'warning',
            title: 'Archivar Academia',
            message: `¿Estás seguro de que deseas archivar "${academy.name}"? Los datos se conservarán pero la academia no será visible.`,
            confirmText: 'Archivar',
            onConfirm: async () => {
                await archiveAcademy.mutateAsync(academy.id);
                setModalVisible(false);
            }
        });
        setModalVisible(true);
    };

    const handleRestorePress = (academy: Academy) => {
        setModalConfig({
            type: 'success',
            title: 'Restaurar Academia',
            message: `¿Deseas restaurar "${academy.name}"?`,
            confirmText: 'Restaurar',
            onConfirm: async () => {
                await unarchiveAcademy.mutateAsync(academy.id);
                setModalVisible(false);
            }
        });
        setModalVisible(true);
    };

    const handleSwitchToAcademy = async (academy: Academy) => {
        if (academy.id !== currentAcademy?.id) {
            await switchAcademy.mutateAsync(academy.id);
        }
    };

    const renderAcademyItem = ({ item }: { item: Academy }) => {
        const isCurrentAcademy = item.id === currentAcademy?.id;

        return (
            <TouchableOpacity
                onPress={() => handleSwitchToAcademy(item)}
                activeOpacity={0.7}
            >
                <Card
                    style={{ ...styles.academyCard, ...(isCurrentAcademy ? styles.currentAcademyCard : {}) }}
                    padding="md"
                >
                    <View style={styles.cardContent}>
                        <View style={styles.academyMainInfo}>
                            <View style={{ ...styles.academyIconContainer, ...(isCurrentAcademy ? styles.currentIconContainer : {}) }}>
                                <Ionicons
                                    name="school"
                                    size={24}
                                    color={isCurrentAcademy ? colors.primary[600] : colors.neutral[500]}
                                />
                            </View>
                            <View style={styles.academyDetails}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.academyName}>{item.name}</Text>
                                    {isCurrentAcademy && (
                                        <View style={styles.currentBadge}>
                                            <Text style={styles.currentBadgeText}>Actual</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    router.push({ pathname: '/academy/edit', params: { id: item.id } } as any);
                                }}
                                style={styles.actionButton}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    showArchived ? handleRestorePress(item) : handleArchivePress(item);
                                }}
                                style={styles.actionButton}
                            >
                                <Ionicons
                                    name={showArchived ? "refresh-outline" : "trash-outline"}
                                    size={20}
                                    color={showArchived ? colors.success[500] : colors.error[500]}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="school" size={24} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Academias</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            {/* Description Section */}
            <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>
                    Gestiona tus academias y crea nuevas
                </Text>
            </View>

            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Input
                        placeholder="Buscar por nombre..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                        style={styles.searchInput}
                        containerStyle={{ marginBottom: 0 }}
                        size="sm"
                    />
                </View>
                {canCreateAcademy && (
                    <Button
                        label="Nueva"
                        leftIcon={<Ionicons name="add" size={20} color={colors.common.white} />}
                        onPress={() => router.push('/academy/new')}
                        style={styles.addButton}
                        size="sm"
                        shadow
                    />
                )}
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(false)}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={!showArchived ? colors.common.white : colors.neutral[400]}
                    />
                    <Text style={[styles.filterTabText, !showArchived && styles.activeFilterTabText]}>
                        Activas
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(true)}
                >
                    <Ionicons
                        name="archive"
                        size={16}
                        color={showArchived ? colors.common.white : colors.neutral[400]}
                    />
                    <Text style={[styles.filterTabText, showArchived && styles.activeFilterTabText]}>
                        Archivadas
                    </Text>
                    {archivedCount > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{archivedCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={colors.primary[500]} style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={filteredAcademies}
                    renderItem={renderAcademyItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="school-outline" size={48} color={colors.neutral[300]} />
                            <Text style={styles.emptyText}>
                                {showArchived ? 'No hay academias archivadas' : 'No tienes academias'}
                            </Text>
                            {!showArchived && canCreateAcademy && (
                                <Button
                                    label="Crear mi primera academia"
                                    onPress={() => router.push('/academy/new')}
                                    style={{ marginTop: spacing.md }}
                                />
                            )}
                        </View>
                    }
                />
            )}

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={() => setModalVisible(false)}
                onConfirm={modalConfig.onConfirm}
                buttonText={modalConfig.confirmText}
                showCancel
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.common.white,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    header: {
        flexDirection: 'row',
        padding: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
        alignItems: 'center',
    },
    searchBar: {
        flex: 1,
    },
    searchInput: {
        backgroundColor: colors.common.white,
    },
    addButton: {
        paddingHorizontal: spacing.md,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.neutral[100],
    },
    activeFilterTab: {
        backgroundColor: colors.primary[500],
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    activeFilterTabText: {
        color: colors.common.white,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: 0,
    },
    academyCard: {
        marginBottom: spacing.sm,
    },
    currentAcademyCard: {
        borderWidth: 2,
        borderColor: colors.primary[300],
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    academyMainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    academyIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    currentIconContainer: {
        backgroundColor: colors.primary[50],
    },
    academyDetails: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    academyName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    currentBadge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    currentBadgeText: {
        fontSize: 10,
        color: colors.primary[700],
        fontWeight: '600',
    },
    academySlug: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionButton: {
        padding: spacing.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.size.md,
        color: colors.neutral[400],
    },
    countBadge: {
        backgroundColor: colors.primary[500],
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        color: colors.common.white,
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
});
