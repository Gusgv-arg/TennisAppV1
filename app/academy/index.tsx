import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
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
                style={styles.cardWrapper}
            >
                <Card
                    style={{ ...styles.academyCard, ...(isCurrentAcademy ? styles.currentAcademyCard : {}) }}
                    padding="md"
                >
                    <View style={styles.cardContent}>
                        <View style={styles.iconsRow}>
                            <View style={{ ...styles.academyIconContainer, ...(isCurrentAcademy ? styles.currentIconContainer : {}) }}>
                                <Ionicons
                                    name="school"
                                    size={32}
                                    color={isCurrentAcademy ? colors.primary[600] : colors.neutral[500]}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    router.push({ pathname: '/academy/edit', params: { id: item.id } } as any);
                                }}
                                style={styles.actionButton}
                            >
                                <Ionicons name="create-outline" size={18} color={colors.primary[500]} />
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
                                    size={18}
                                    color={showArchived ? colors.success[500] : colors.error[500]}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.academyInfo}>
                            <Text style={styles.academyName} numberOfLines={2}>{item.name}</Text>
                            {isCurrentAcademy && (
                                <View style={styles.currentBadge}>
                                    <Text style={styles.currentBadgeText}>Actual</Text>
                                </View>
                            )}
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

            <View style={styles.centerContainer}>
                <View style={styles.controlsWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={colors.neutral[400]} />
                        <TextInput
                            placeholder="Buscar..."
                            placeholderTextColor={colors.neutral[400]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInputText}
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
                <View style={styles.listContainer}>
                    <FlatList
                        data={filteredAcademies}
                        renderItem={renderAcademyItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        numColumns={4}
                        columnWrapperStyle={styles.columnWrapper}
                        key={`grid-4`} // Force re-render when changing layout
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
                </View>
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
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    centerContainer: {
        alignItems: 'center',
        paddingVertical: spacing.md,
        backgroundColor: colors.common.white,
    },
    controlsWrapper: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
        maxWidth: 800, // Increased width as requested
        paddingHorizontal: spacing.md,
    },
    searchInputContainer: {
        flex: 1, // Ensure it takes available space
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral[50], // Match background or allow slight contrast
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 48, // Slightly taller as requested "mas grande"? or just width? Assuming width primarily but height 40->48 is good for desktop.
        // No border, no shadow
    },
    searchInputText: {
        flex: 1,
        height: '100%',
        color: colors.neutral[900],
        fontSize: typography.size.sm,
        marginLeft: spacing.xs,
        outlineStyle: 'none' as any,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        height: 48, // Matched height with input
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.md,
        justifyContent: 'center',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
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
    listContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 1400,
        alignSelf: 'center',
    },
    listContent: {
        padding: spacing.lg,
    },
    columnWrapper: {
        gap: spacing.lg,
    },
    cardWrapper: {
        flex: 1,
        maxWidth: '23%', // 4 columns
        aspectRatio: 1,
        marginBottom: spacing.lg,
    },
    academyCard: {
        flex: 1,
        overflow: 'hidden',
    },
    currentAcademyCard: {
        borderWidth: 2,
        borderColor: colors.primary[300],
        backgroundColor: colors.primary[50],
    },
    cardContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        width: '100%',
        padding: spacing.md,
    },
    iconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        width: '100%',
    },
    academyInfo: {
        alignItems: 'center',
        gap: 4,
        width: '100%',
    },
    academyIconContainer: {
        width: 56, // Slightly smaller to fit row better? Or keep 64. Let's keep 64 but maybe 56 is better balance. User didn't ask to shrink. I'll keep 64.
        height: 64,
        borderRadius: 16,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
    },
    currentIconContainer: {
        backgroundColor: colors.primary[100],
    },
    academyName: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[900],
        textAlign: 'center',
        width: '100%',
    },
    currentBadge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
    },
    currentBadgeText: {
        fontSize: 9,
        color: colors.primary[700],
        fontWeight: '600',
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.common.white,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        // Align size visually with the big icon? No, big icon is 64px. Buttons are smaller. 
        // User said "3 icons ... in same line".
        // Maybe make buttons slightly larger?
        height: 40,
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: spacing.md,
        width: '100%',
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
