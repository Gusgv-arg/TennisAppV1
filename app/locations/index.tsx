import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { LocationModal } from '@/src/features/locations/components/LocationModal';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { useLocations } from '@/src/features/locations/hooks/useLocations';
import { useTheme } from '@/src/hooks/useTheme';
import { Location } from '@/src/types/location';
import { showError, showSuccess } from '@/src/utils/toast';

export default function LocationsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: locations, isLoading, refetch } = useLocations(searchQuery, showArchived);
    const { data: archivedLocations } = useLocations('', true);
    const insets = useSafeAreaInsets();

    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

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

    const { archiveLocation, unarchiveLocation } = useLocationMutations();
    const archivedCount = archivedLocations?.length || 0;

    const handleArchivePress = (id: string) => {
        setModalConfig({
            type: 'warning',
            title: t('delete'),
            message: t('deleteLocationConfirm'),
            confirmText: 'Archivar',
            onConfirm: async () => {
                try {
                    await archiveLocation.mutateAsync(id);
                    setModalVisible(false);
                    setTimeout(() => showSuccess('Ubicación Archivada', 'La ubicación ya no estará disponible para nuevas clases.'), 100);
                } catch (error: any) {
                    showError('Error', error.message || 'No se pudo archivar la ubicación.');
                }
            }
        });
        setModalVisible(true);
    };

    const handleRestorePress = (id: string) => {
        setModalConfig({
            type: 'success',
            title: t('reactivate'),
            message: t('reactivateLocationConfirm'),
            confirmText: 'Reactivar',
            onConfirm: async () => {
                try {
                    await unarchiveLocation.mutateAsync(id);
                    setModalVisible(false);
                    setTimeout(() => showSuccess('Ubicación Reactivada', 'La ubicación vuelve a estar disponible.'), 100);
                } catch (error: any) {
                    showError('Error', error.message || 'No se pudo reactivar la ubicación.');
                }
            }
        });
        setModalVisible(true);
    };

    const renderLocationItem = ({ item }: { item: Location }) => (
        <Card style={styles.locationCard} padding="md">
            <View style={styles.cardContent}>
                <TouchableOpacity
                    style={styles.locationMainInfo}
                    onPress={() => router.push(`/locations/${item.id}` as any)}
                    delayPressIn={100}
                >
                    <View style={styles.infoRow}>
                        <View style={styles.headerRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="location" size={16} color={theme.components.button.primary.bg} />
                            </View>
                            <Text style={styles.locationName}>{item.name}</Text>
                        </View>

                        <Text style={styles.locationAddress} numberOfLines={1}>
                            <Text style={{ opacity: 0.5, fontWeight: '400' }}>• </Text>
                            {item.address || t('noAddress')}
                        </Text>

                        {item.notes && (
                            <View style={styles.noteContainer}>
                                <Ionicons name="chatbubble-outline" size={10} color={theme.text.tertiary} />
                                <Text style={styles.locationNotes} numberOfLines={1}>
                                    {item.notes}
                                </Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedLocation(item);
                            setLocationModalVisible(true);
                        }}
                        style={styles.actionButton}
                    >
                        <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => showArchived ? handleRestorePress(item.id) : handleArchivePress(item.id)}
                        style={styles.actionButton}
                    >
                        <Ionicons
                            name={showArchived ? "refresh-outline" : "trash-outline"}
                            size={20}
                            color={showArchived ? theme.status.success : theme.status.error}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View style={[styles.headerContainer, {
                paddingTop: insets.top + 8,
                paddingBottom: 4,
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
                        <Ionicons name="location" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.headerTitleText}>Ubicaciones</Text>
                    </View>
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Body */}
            <View style={styles.bodyContainer}>
                <Text style={styles.subtitleText}>
                    Canchas y lugares donde das clases
                </Text>

                <View style={styles.controlsWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={theme.text.tertiary} />
                        <TextInput
                            placeholder="Buscar ubicaciones..."
                            placeholderTextColor={theme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInputText}
                            textAlignVertical="center"
                        />
                    </View>
                    <Button
                        label="Nueva"
                        leftIcon={<Ionicons name="add" size={20} color="#FFFFFF" />}
                        onPress={() => {
                            setSelectedLocation(null);
                            setLocationModalVisible(true);
                        }}
                        style={styles.addButton}
                        size="sm"
                        shadow
                    />
                </View>

                {/* Desktop Center Wrapper for List */}
                <View style={styles.centerWrapper}>
                    {/* Filters */}
                    <View style={styles.filterContainer}>
                        <TouchableOpacity
                            style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                            onPress={() => setShowArchived(false)}
                        >
                            <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={!showArchived ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, !showArchived && styles.activeFilterTabText]}>
                                {t('tabLocations')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterTab, showArchived && styles.activeFilterTab]}
                            onPress={() => setShowArchived(true)}
                        >
                            <Ionicons
                                name="archive"
                                size={16}
                                color={showArchived ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, showArchived && styles.activeFilterTabText]}>
                                {t('showArchivedLocations')}
                            </Text>
                            {archivedCount > 0 && (
                                <View style={styles.countBadge}>
                                    <Text style={styles.countBadgeText}>{archivedCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ flex: 1 }} />
                    ) : (
                        <FlatList
                            data={locations}
                            renderItem={renderLocationItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="location-outline" size={48} color={theme.text.disabled} />
                                    <Text style={styles.emptyText}>{t('noLocationsFound')}</Text>
                                </View>
                            }
                        />
                    )}
                </View>
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

            <LocationModal
                visible={locationModalVisible}
                onClose={() => setLocationModalVisible(false)}
                location={selectedLocation}
            />
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    // Header Styles
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
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
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    controlsWrapper: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
        maxWidth: 480,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        alignSelf: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 38,
        backgroundColor: theme.background.input,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    searchInputText: {
        flex: 1,
        height: '100%',
        ...typography.variants.bodyMedium,
        marginLeft: spacing.xs,
        paddingVertical: 0,
        color: theme.text.primary,
        outlineStyle: 'none' as any,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        height: 38,
    },
    centerWrapper: {
        width: '100%',
        maxWidth: 630, // Increased by ~30% per user request (was 480)
        alignSelf: 'center',
        flex: 1,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        marginTop: 15,
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
    activeFilterTab: {
        backgroundColor: theme.components.button.primary.bg,
    },
    filterTabText: {
        ...typography.variants.labelSmall,
        color: theme.text.tertiary,
    },
    activeFilterTabText: {
        color: theme.text.inverse,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: 0,
    },
    locationCard: {
        marginBottom: spacing.sm,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    locationMainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: spacing.md,
        rowGap: 2,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    iconContainer: {
        marginRight: spacing.xs,
        padding: 4,
        borderRadius: 4,
        backgroundColor: theme.background.subtle,
    },
    locationName: {
        ...typography.variants.bodyMedium,
        fontWeight: '600',
        color: theme.text.primary,
    },
    locationAddress: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
    },
    locationNotes: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        fontStyle: 'italic',
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.background.subtle,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
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
        ...typography.variants.bodyMedium,
        color: theme.text.tertiary,
    },
    countBadge: {
        backgroundColor: theme.components.button.primary.bg,
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        color: theme.text.inverse,
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
});
