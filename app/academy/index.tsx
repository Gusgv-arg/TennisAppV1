import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { AcademyModal } from '@/src/features/academy/components/AcademyModal';
import { useAcademyMutations, useCurrentAcademy, useCurrentAcademyMember, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';
import { Academy } from '@/src/types/academy';

export default function AcademiesScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { width } = useWindowDimensions();
    const numColumns = width < 600 ? 2 : width < 1000 ? 3 : 4;
    const styles = useMemo(() => createStyles(theme, numColumns), [theme, numColumns]);

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

    const insets = useSafeAreaInsets();

    const renderAcademyItem = ({ item }: { item: Academy }) => {
        const isCurrentAcademy = item.id === currentAcademy?.id;

        return (
            <TouchableOpacity
                onPress={() => handleSwitchToAcademy(item)}
                activeOpacity={0.9}
                style={styles.cardWrapper}
            >
                <Card
                    style={[
                        styles.academyCard,
                        {
                            backgroundColor: theme.background.surface,
                            borderColor: isCurrentAcademy ? theme.components.button.primary.bg : 'transparent',
                            borderWidth: isCurrentAcademy ? 2 : 0,
                        }
                    ]}
                    padding="none" // Custom padding layout
                    elevation="sm"
                >
                    <View style={styles.cardInner}>
                        {/* Header: Actions */}
                        <View style={styles.cardHeader}>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setSelectedAcademy(item);
                                        setAcademyModalVisible(true);
                                    }}
                                    style={[styles.ghostActionButton]}
                                >
                                    <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        showArchived ? handleRestorePress(item) : handleArchivePress(item);
                                    }}
                                    style={[styles.ghostActionButton]}
                                >
                                    <Ionicons
                                        name={showArchived ? "refresh-outline" : "trash-outline"}
                                        size={20}
                                        color={showArchived ? theme.components.button.primary.bg : theme.status.error}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Body: Icon + Name */}
                        <View style={styles.cardBody}>
                            <View style={[
                                styles.iconContainer,
                                {
                                    backgroundColor: isCurrentAcademy ? theme.components.badge.primary : theme.background.subtle,
                                }
                            ]}>
                                <Ionicons
                                    name="school"
                                    size={32}
                                    color={isCurrentAcademy ? theme.components.button.primary.bg : theme.text.secondary}
                                />
                            </View>

                            <Text style={styles.academyName} numberOfLines={2}>
                                {item.name}
                            </Text>

                            {/* Status Indicator */}
                            {isCurrentAcademy ? (
                                <View style={styles.statusIndicator}>
                                    <View style={[styles.statusDot, { backgroundColor: theme.status.success }]} />
                                    <Text style={[styles.statusText, { color: theme.status.success }]}>Actual</Text>
                                </View>
                            ) : (
                                <View style={styles.statusPlaceholder} />
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header - Surface Background */}
            <View style={[styles.headerContainer, {
                paddingTop: insets.top + 8, // Fixed 8px top padding like CustomTabHeader
                paddingBottom: 4,           // Fixed 4px bottom padding like CustomTabHeader
            }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.headerTitleWrapper, { minHeight: 78 }]}>
                    <View style={styles.headerTitleRow}>
                        <Ionicons name="school" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.headerTitleText}>Academias</Text>
                    </View>
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Body - Default Background */}
            <View style={styles.bodyContainer}>
                {/* Subtitle in Body */}
                <Text style={styles.subtitleText}>
                    Gestiona tus Academias
                </Text>

                <View style={styles.controlsWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={theme.text.tertiary} />
                        <TextInput
                            placeholder="Buscar..."
                            placeholderTextColor={theme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInputText}
                            textAlignVertical="center"
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

                {/* Filters */}
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterTab, !showArchived && styles.filterTabActive]}
                        onPress={() => setShowArchived(false)}
                    >
                        <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={!showArchived ? theme.components.button.primary.text : theme.text.tertiary}
                        />
                        <Text style={[styles.filterTabText, !showArchived && styles.filterTabTextActive]}>
                            Activas
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, showArchived && styles.filterTabActive]}
                        onPress={() => setShowArchived(true)}
                    >
                        <Ionicons
                            name="archive"
                            size={16}
                            color={showArchived ? theme.components.button.primary.text : theme.text.tertiary}
                        />
                        <Text style={[styles.filterTabText, showArchived && styles.filterTabTextActive]}>
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
                            numColumns={numColumns}
                            columnWrapperStyle={styles.columnWrapper}
                            key={`grid-${numColumns}`} // Force re-render when changing layout
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="school-outline" size={48} color={theme.text.disabled || theme.text.tertiary} />
                                    <Text style={styles.emptyText}>
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
            </View>

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

const createStyles = (theme: Theme, numColumns: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    // Custom Header Styles
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
        // height removed, dynamic via inline style
    },
    headerLeft: {
        width: 40,
        alignItems: 'flex-start',
    },
    headerRight: {
        width: 40,
    },
    backButton: {
        padding: 4,
    },
    headerTitleWrapper: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    // Body Styles
    bodyContainer: {
        flex: 1,
        backgroundColor: theme.background.default,
        paddingTop: spacing.md,
    },
    subtitleText: {
        fontSize: typography.size.sm, // Using 'sm' (14) or 'xs' (12) per requirement? Layout uses xs for subtitle usually. Settings uses sm for description.
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    descriptionText: {
        ...typography.variants.bodyMedium,
        textAlign: 'center',
        color: theme.text.secondary,
        // Deprecated in favor of subtitleText but keeping for safety if referenced elsewhere
    },
    controlsWrapper: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
        maxWidth: 480, // Increased by 20% from 400
        paddingHorizontal: spacing.md,
        alignSelf: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 38, // Reduced by ~20% from 48
        backgroundColor: theme.background.input,
    },
    searchInputText: {
        flex: 1,
        height: '100%',
        ...typography.variants.bodyMedium,
        marginLeft: spacing.xs,
        outlineStyle: 'none' as any,
        paddingVertical: 0,
        color: theme.text.primary,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        height: 38, // Reduced by ~20% from 48
    },
    filterContainer: {
        marginTop: 15,
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
        backgroundColor: theme.background.subtle,
    },
    filterTabActive: {
        backgroundColor: theme.components.button.primary.bg,
    },
    filterTabText: {
        ...typography.variants.labelSmall,
        color: theme.text.secondary,
    },
    filterTabTextActive: {
        color: theme.components.button.primary.text,
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
        width: `${(100 / numColumns) - 2}%`,
        marginBottom: spacing.lg,
        minHeight: numColumns > 2 ? 200 : 160,
    },
    academyCard: {
        flex: 1,
        overflow: 'hidden',
    },
    cardInner: {
        flex: 1,
        padding: spacing.md,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: spacing.xs,
        height: 32,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    ghostActionButton: {
        padding: 4,
        borderRadius: 6,
    },
    cardBody: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    academyName: {
        ...typography.variants.bodyLarge,
        fontWeight: '600',
        textAlign: 'center',
        width: '100%',
        color: theme.text.primary,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        ...typography.variants.labelSmall,
        fontSize: 11,
        fontWeight: '600',
    },
    statusPlaceholder: {
        height: 24,
        opacity: 0,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: spacing.md,
        width: '100%',
    },
    emptyText: {
        ...typography.variants.bodyLarge,
        color: theme.text.secondary,
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
        ...typography.variants.labelSmall,
        fontSize: 10,
        lineHeight: 12,
    },
});
