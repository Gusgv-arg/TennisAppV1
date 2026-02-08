import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { AcademyModal } from '@/src/features/academy/components/AcademyModal';
import { useAcademyMutations, useCurrentAcademy, useCurrentAcademyMember, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';
import { Academy } from '@/src/types/academy';

export default function AcademiesScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { data: academiesData, isLoading } = useUserAcademies();
    const { data: currentAcademy } = useCurrentAcademy();
    const { data: currentMember } = useCurrentAcademyMember();
    const { archiveAcademy, unarchiveAcademy, switchAcademy } = useAcademyMutations();

    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [academyModalVisible, setAcademyModalVisible] = useState(false);
    const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);

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
                    style={{ ...styles.academyCard, ...(isCurrentAcademy ? { borderColor: theme.components.button.primary.bg, backgroundColor: theme.components.badge.primary } : { backgroundColor: theme.background.surface }) }}
                    padding="md"
                >
                    <View style={styles.cardContent}>
                        <View style={styles.iconsRow}>
                            <View style={{ ...styles.academyIconContainer, backgroundColor: isCurrentAcademy ? theme.components.badge.primary : theme.background.subtle }}>
                                <Ionicons
                                    name="school"
                                    size={32}
                                    color={isCurrentAcademy ? theme.components.button.primary.bg : theme.text.secondary}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setSelectedAcademy(item);
                                    setAcademyModalVisible(true);
                                }}
                                style={[styles.actionButton, { backgroundColor: isCurrentAcademy ? theme.background.surface : theme.background.default }]}
                            >
                                <Ionicons name="create-outline" size={18} color={theme.components.button.primary.bg} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    showArchived ? handleRestorePress(item) : handleArchivePress(item);
                                }}
                                style={[styles.actionButton, { backgroundColor: isCurrentAcademy ? theme.background.surface : theme.background.default }]}
                            >
                                <Ionicons
                                    name={showArchived ? "refresh-outline" : "trash-outline"}
                                    size={18}
                                    color={showArchived ? theme.status.success : theme.status.error}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.academyInfo}>
                            <Text style={[styles.academyName, { color: theme.text.primary }]} numberOfLines={2}>{item.name}</Text>
                            {isCurrentAcademy && (
                                <View style={[styles.currentBadge, { backgroundColor: theme.components.badge.primary }]}>
                                    <Text style={[styles.currentBadgeText, { color: theme.components.button.primary.bg }]}>Actual</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="school" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                            <Text style={[styles.headerTitleText, { color: theme.text.primary }]}>Academias</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            {/* Description Section */}
            <View style={[styles.descriptionSection, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                <Text style={[styles.descriptionText, { color: theme.text.secondary }]}>
                    Gestiona tus Academias y crea nuevas
                </Text>
            </View>

            <View style={[styles.centerContainer, { backgroundColor: theme.background.surface }]}>
                <View style={styles.controlsWrapper}>
                    <View style={[styles.searchInputContainer, { backgroundColor: theme.background.input }]}>
                        <Ionicons name="search" size={20} color={theme.text.tertiary} />
                        <TextInput
                            placeholder="Buscar..."
                            placeholderTextColor={theme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={[styles.searchInputText, { color: theme.text.primary }]}
                        />
                    </View>
                    {canCreateAcademy && (
                        <Button
                            label="Nueva"
                            leftIcon={<Ionicons name="add" size={20} color={theme.components.button.primary.text} />}
                            onPress={() => {
                                setSelectedAcademy(null);
                                setAcademyModalVisible(true);
                            }}
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
                    style={[styles.filterTab, { backgroundColor: theme.background.subtle }, !showArchived && { backgroundColor: theme.components.button.primary.bg }]}
                    onPress={() => setShowArchived(false)}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={!showArchived ? theme.components.button.primary.text : theme.text.tertiary}
                    />
                    <Text style={[styles.filterTabText, { color: theme.text.secondary }, !showArchived && { color: theme.components.button.primary.text }]}>
                        Activas
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, { backgroundColor: theme.background.subtle }, showArchived && { backgroundColor: theme.components.button.primary.bg }]}
                    onPress={() => setShowArchived(true)}
                >
                    <Ionicons
                        name="archive"
                        size={16}
                        color={showArchived ? theme.components.button.primary.text : theme.text.tertiary}
                    />
                    <Text style={[styles.filterTabText, { color: theme.text.secondary }, showArchived && { color: theme.components.button.primary.text }]}>
                        Archivadas
                    </Text>
                    {archivedCount > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: showArchived ? theme.components.button.primary.text : theme.components.button.primary.bg }]}>
                            <Text style={[styles.countBadgeText, { color: showArchived ? theme.components.button.primary.bg : theme.components.button.primary.text }]}>{archivedCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ flex: 1 }} />
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
                                <Ionicons name="school-outline" size={48} color={theme.text.disabled || theme.text.tertiary} />
                                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                                    {showArchived ? 'No hay academias archivadas' : 'No tienes academias'}
                                </Text>
                                {!showArchived && canCreateAcademy && (
                                    <Button
                                        label="Crear mi primera academia"
                                        onPress={() => {
                                            setSelectedAcademy(null);
                                            setAcademyModalVisible(true);
                                        }}
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

            <AcademyModal
                visible={academyModalVisible}
                onClose={() => setAcademyModalVisible(false)}
                academy={selectedAcademy}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        textAlign: 'center',
    },
    centerContainer: {
        alignItems: 'center',
        paddingVertical: spacing.md,
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
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 48, // Slightly taller as requested "mas grande"? or just width? Assuming width primarily but height 40->48 is good for desktop.
        // No border, no shadow
    },
    searchInputText: {
        flex: 1,
        height: '100%',
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
    },
    activeFilterTab: {
        // Handled in line styles
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    activeFilterTabText: {
        // Handled in line styles
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
        width: 64, // Slightly smaller to fit row better? Or keep 64. Let's keep 64 but maybe 56 is better balance. User didn't ask to shrink. I'll keep 64.
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    currentIconContainer: {
        // Handled in line styles
    },
    academyName: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        textAlign: 'center',
        width: '100%',
    },
    currentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
    },
    currentBadgeText: {
        fontSize: 9,
        fontWeight: '600',
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
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
    },
    countBadge: {
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
});
