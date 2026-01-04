import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { useLocations } from '@/src/features/locations/hooks/useLocations';

export default function LocationsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: locations, isLoading, refetch } = useLocations(searchQuery, showArchived);

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
                            <Ionicons name="location-outline" size={24} color={colors.primary[600]} />
                        </View>
                        <View style={styles.locationDetails as any}>
                            <Text style={styles.locationName as any}>{item.name}</Text>
                            <Text style={styles.locationAddress as any} numberOfLines={1}>
                                {item.address || t('noAddress')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        {!item.is_archived ? (
                            <>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        router.push(`/locations/${item.id}`);
                                    }}
                                >
                                    <Ionicons name="eye-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        router.push(`/locations/edit?id=${item.id}`);
                                    }}
                                >
                                    <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeletePress(item.id);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
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
                                <Ionicons name="refresh-outline" size={20} color={colors.success[500]} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Input
                        placeholder={t('searchLocations')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                        style={styles.searchInput}
                        containerStyle={{ marginBottom: 0 }}
                        size="sm"
                    />
                </View>
                <Button
                    label={t('addLocation')}
                    leftIcon={<Ionicons name="add" size={24} color={colors.common.white} />}
                    onPress={() => router.push('/locations/new')}
                    style={styles.addButton}
                    shadow
                />
            </View>

            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(false)}
                >
                    <Text style={[styles.filterTabText, !showArchived && styles.activeFilterTabText]}>
                        {t('tabLocations')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(true)}
                >
                    <Text style={[styles.filterTabText, showArchived && styles.activeFilterTabText]}>
                        {t('showArchived')}
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={locations}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="location-outline" size={48} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>{t('noLocationsFound')}</Text>
                    </View>
                }
            />

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
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
        marginBottom: spacing.xs,
        gap: spacing.md,
    },
    filterTab: {
        paddingVertical: spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeFilterTab: {
        borderBottomColor: colors.primary[500],
    },
    filterTabText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[500],
    },
    activeFilterTabText: {
        color: colors.primary[600],
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
        backgroundColor: colors.primary[50],
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
        color: colors.neutral[900],
    },
    locationAddress: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
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
        color: colors.neutral[400],
        marginTop: spacing.md,
    },
});
