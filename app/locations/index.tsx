import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { LocationModal } from '@/src/features/locations/components/LocationModal';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { useLocations } from '@/src/features/locations/hooks/useLocations';
import { useTheme } from '@/src/hooks/useTheme';
import { Location } from '@/src/types/location';

export default function LocationsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: locations, isLoading, refetch } = useLocations(searchQuery, showArchived);
    const { data: archivedLocations } = useLocations('', true); // Get archived count

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    const archivedCount = archivedLocations?.length || 0;

    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [locationToProcess, setLocationToProcess] = useState<string | null>(null);

    const { archiveLocation, unarchiveLocation } = useLocationMutations();

    const handleDeletePress = (id: string) => {
        setLocationToProcess(id);
        setDeleteConfirmVisible(true);
    };

    const handleReactivatePress = (id: string) => {
        setLocationToProcess(id);
        setReactivateConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (locationToProcess) {
            await archiveLocation.mutateAsync(locationToProcess);
            setLocationToProcess(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (locationToProcess) {
            await unarchiveLocation.mutateAsync(locationToProcess);
            setLocationToProcess(null);
        }
        setReactivateConfirmVisible(false);
    };

    const renderLocationItem = ({ item }: { item: any }) => (
        <TouchableOpacity onPress={() => router.push(`/locations/${item.id}` as any)} activeOpacity={0.7}>
            <Card style={styles.locationCard as any} padding="md">
                <View style={styles.locationInfo as any}>
                    <View style={styles.locationMainInfo as any}>
                        <View style={styles.locationIconContainer as any}>
                            <Ionicons name="location-outline" size={24} color={theme.components.button.primary.bg} />
                        </View>
                        <View style={styles.locationDetails as any}>
                            <Text style={styles.locationName as any}>{item.name}</Text>
                            <Text style={styles.locationAddress as any} numberOfLines={1}>
                                {item.address || t('noAddress')}
                            </Text>
                            {item.notes && (
                                <Text style={styles.locationNotes as any} numberOfLines={1}>
                                    Notas: {item.notes}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        {!item.is_archived ? (
                            <>
                                {/* "View" icon removed as per request */}
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setSelectedLocation(item);
                                        setLocationModalVisible(true);
                                    }}
                                >
                                    <Ionicons name="create-outline" size={20} color={theme.components.button.primary.bg} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeletePress(item.id);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleReactivatePress(item.id);
                                }}
                            >
                                <Ionicons name="refresh-outline" size={20} color={theme.status.success} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="location" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Ubicaciones</Text>
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
                }}
            />

            {/* Description Section */}
            <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>
                    Canchas y lugares donde das clases
                </Text>
            </View>

            {/* Desktop Center Wrapper */}
            <View style={styles.centerWrapper}>
                <View style={styles.header}>
                    <View style={styles.searchBar}>
                        <Input
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            leftIcon={<Ionicons name="search" size={20} color={theme.text.tertiary} />}
                            style={styles.searchInput}
                            containerStyle={{ marginBottom: 0 }}
                            size="sm"
                        />
                    </View>
                    <Button
                        label="Nueva"
                        leftIcon={<Ionicons name="add" size={20} color={theme.text.inverse} />}
                        onPress={() => {
                            setSelectedLocation(null);
                            setLocationModalVisible(true);
                        }}
                        style={styles.addButton}
                        size="sm"
                        shadow
                    />
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

                <FlatList
                    data={locations}
                    renderItem={renderLocationItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.components.button.primary.bg} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="location-outline" size={48} color={theme.text.disabled} />
                            <Text style={styles.emptyText}>{t('noLocationsFound')}</Text>
                        </View>
                    }
                />
            </View>

            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title={t('delete')}
                message={t('deleteLocationConfirm')}
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
                showCancel
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="success"
                title={t('reactivate')}
                message={t('reactivateLocationConfirm')}
                onClose={() => setReactivateConfirmVisible(false)}
                onConfirm={handleConfirmReactivate}
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
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: theme.background.surface,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
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
        backgroundColor: theme.background.surface,
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
        backgroundColor: theme.background.subtle,
    },
    activeFilterTab: {
        backgroundColor: theme.components.button.primary.bg,
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.tertiary,
    },
    activeFilterTabText: {
        color: theme.text.inverse,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: spacing.xs,
    },
    locationCard: {
        marginBottom: spacing.sm,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationMainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    locationIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.components.button.primary.bg + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    locationDetails: {
        flex: 1,
    },
    locationName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
    },
    locationAddress: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
    },
    locationNotes: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
        fontStyle: 'italic',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIconBtn: {
        padding: spacing.xs,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        marginTop: spacing.xxxl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: typography.size.md,
        color: theme.text.tertiary,
        marginTop: spacing.md,
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
    centerWrapper: {
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
        flex: 1,
    },
});
