import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commonStyles } from '@/src/design/common';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { TimePickerModal } from '@/src/features/calendar/components/TimePickerModal';
import { useBulkActions } from '@/src/features/calendar/hooks/useBulkActions';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Session } from '@/src/types/session';
import { showError, showInfo } from '@/src/utils/toast';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';
import { HelpIcon } from '@/src/design/components/HelpIcon';

export default function BulkActionsScreen() {
    const router = useRouter();
    const { profile } = useAuthStore();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const insets = useSafeAreaInsets();

    const isAdmin = profile?.role === 'coach'; // In this version, coaches are admins/owners
    const { theme } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(theme), [theme]);

    // Hook logic
    const handleTypeChange = (type: 'all' | 'group' | 'individual') => {
        updateFilter('classType', type);
        if (type === 'individual') {
            updateFilter('groupId', null);
        }
    };

    const {
        filters,
        setFilters,
        updateFilter,
        sessions,
        isLoading,
        totalFound,
    } = useBulkActions();

    const { deleteSessionsBulk, removePlayersFromSessionsBulk, addPlayersToSessionsBulk } = useSessionMutations();

    // Data for selectors
    const { data: groups } = useClassGroups('active');
    const { data: players } = usePlayers(undefined, 'active');

    // UI States
    const [mode, setMode] = useState<'roster' | 'delete'>('roster');
    const [rosterAction, setRosterAction] = useState<'add' | 'remove'>('add');

    // For 'Add' action: players to be added
    const [targetPlayerIds, setTargetPlayerIds] = useState<string[]>([]);

    // Legacy / Shared states
    const [selectedAction, setSelectedAction] = useState<'delete' | 'edit' | 'remove_players' | 'add_players' | null>(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filter UI States
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [startTimePickerVisible, setStartTimePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');

    const [playerPlanMap, setPlayerPlanMap] = useState<Record<string, string>>({});
    const [showPlanAssignment, setShowPlanAssignment] = useState(false);

    // Filter helpers
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const handleTimeSelect = (h: number, m: number, type: 'start' | 'end') => {
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        updateFilter(type === 'start' ? 'startTime' : 'endTime', timeStr);

        if (type === 'start') {
            // Auto-set end time to +1 hour
            const endH = Math.min(h + 1, 23);
            const endM = h === 23 ? 59 : m;
            const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
            updateFilter('endTime', endTimeStr);
        }
    };

    const handleActionPress = (action: 'delete' | 'edit' | 'remove_players' | 'add_players') => {
        if (totalFound === 0) {
            showInfo(t('calendar.bulk.noClassesSelected'), t('calendar.bulk.noClassesSelected'));
            return;
        }

        if (action === 'add_players') {
            if (targetPlayerIds.length === 0) {
                showInfo(t('calendar.bulk.addPlayers'), t('calendar.bulk.selectPlayersToAdd'));
                return;
            }
            setSelectedAction('add_players');
            setShowPlanAssignment(true);
            return;
        }

        if (action === 'remove_players') {
            if (filters.playerIds.length === 0) {
                showInfo(t('calendar.bulk.removePlayers'), t('calendar.bulk.selectPlayersToRemove'));
                return;
            }
            setSelectedAction('remove_players');
            setCancellationReason(t('calendar.bulk.removePlayers'));
            setConfirmModalVisible(true);
            return;
        }
        if (action === 'delete') {
            if (!isAdmin) {
                showError(t('common.error'), t('calendar.bulk.adminOnly'));
                return;
            }

            if (filters.playerIds.length > 0) {
                Alert.alert(
                    t('calendar.bulk.deleteActionTitle'),
                    t('calendar.bulk.deleteActionMessage', { count: filters.playerIds.length }),
                    [
                        {
                            text: t('common.cancel'),
                            style: 'cancel'
                        },
                        {
                            text: t('calendar.bulk.deleteActionRemovePlayers'),
                            onPress: () => {
                                setSelectedAction('remove_players');
                                setCancellationReason(t('calendar.bulk.removePlayers'));
                                setConfirmModalVisible(true);
                            }
                        },
                        {
                            text: t('calendar.bulk.deleteActionDeleteComplete'),
                            style: 'destructive',
                            onPress: () => {
                                setSelectedAction('delete');
                                setCancellationReason('');
                                setConfirmModalVisible(true);
                            }
                        }
                    ]
                );
            } else {
                setSelectedAction('delete');
                setCancellationReason('');
                setConfirmModalVisible(true);
            }
        } else {
            showInfo(t('common.upcoming'), t('common.bulkEditUnavailable'));
        }
    };

    const hasCriticalSessions = useMemo(() => {
        const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000);
        return sessions.some(s => new Date(s.scheduled_at) < threshold);
    }, [sessions]);

    const confirmAction = async () => {
        if (!selectedAction) return;
        setIsProcessing(true);

        try {
            const sessionIds = sessions.map(s => s.id);

            if (selectedAction === 'delete') {
                await deleteSessionsBulk.mutateAsync({
                    sessionIds,
                    reason: cancellationReason || 'Borrado Masivo'
                });
            } else if (selectedAction === 'remove_players') {
                await removePlayersFromSessionsBulk.mutateAsync({
                    sessionIds,
                    playerIds: filters.playerIds
                });
            } else if (selectedAction === 'add_players') {
                await addPlayersToSessionsBulk.mutateAsync({
                    sessionIds,
                    playerIds: targetPlayerIds,
                    playerPlanMap: playerPlanMap
                });
            }

            router.back();
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
            setConfirmModalVisible(false);
        }
    };

    const toggleDay = (dayIndex: number) => {
        const currentDays = filters.daysOfWeek;
        if (currentDays.includes(dayIndex)) {
            updateFilter('daysOfWeek', currentDays.filter(d => d !== dayIndex));
        } else {
            updateFilter('daysOfWeek', [...currentDays, dayIndex].sort());
        }
    };

    const filteredPlayers = useMemo(() => {
        if (!playerSearch) return players || [];
        return (players || []).filter((p: any) => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()));
    }, [players, playerSearch]);

    const getSelectedPlayersLabel = () => {
        if (mode === 'roster' && rosterAction === 'add') {
            if (targetPlayerIds.length === 0) return t('calendar.bulk.addPlayers');
            if (targetPlayerIds.length === 1) {
                return players?.find((p: any) => p.id === targetPlayerIds[0])?.full_name || t('calendar.bulk.playersCount', { count: 1 });
            }
            return t('calendar.bulk.addPlayersCount', { count: targetPlayerIds.length });
        }

        if (filters.playerIds.length === 0) {
            return (mode === 'roster' && rosterAction === 'remove') ? t('calendar.bulk.removePlayers') : t('calendar.bulk.filterByPlayer');
        }
        if (filters.playerIds.length === 1) {
            return players?.find((p: any) => p.id === filters.playerIds[0])?.full_name || t('calendar.bulk.playersCount', { count: 1 });
        }
        return t('calendar.bulk.playersCount', { count: filters.playerIds.length });
    };

    const getSelectedGroupLabel = () => {
        if (!filters.groupId) return t('calendar.bulk.filterByGroup');
        return groups?.find((g: any) => g.id === filters.groupId)?.name || t('calendar.bulk.groupSelected');
    };

    const [helpModalVisible, setHelpModalVisible] = useState(false);
    const [helpModalConfig, setHelpModalConfig] = useState<{ title: string; items: HelpItem[] }>({
        title: '',
        items: []
    });

    const showBulkHelp = () => {
        setHelpModalConfig({
            title: t('calendar.modals.help.bulkEdition.title') || t('calendar.bulk.title'),
            items: [
                {
                    icon: 'options-outline',
                    title: t('calendar.modals.help.bulkEdition.items.step1.title') || '1. Elegir Acción',
                    description: t('calendar.modals.help.bulkEdition.items.step1.desc') || 'Seleccioná primero si vas a operar sobre Alumnos o Clases en los botones superiores.'
                },
                {
                    icon: 'search-outline',
                    title: t('calendar.modals.help.bulkEdition.items.step2.title') || '2. Filtrar Sesiones',
                    description: t('calendar.modals.help.bulkEdition.items.step2.desc') || 'Definí las fechas y días de las clases que querés que se vean afectadas por el cambio.'
                },
                {
                    icon: 'checkmark-done-outline',
                    title: t('calendar.modals.help.bulkEdition.items.step3.title') || '3. Aplicar en Lote',
                    description: t('calendar.modals.help.bulkEdition.items.step3.desc') || 'Una vez filtrado, usá el botón inferior para procesar todas las clases de una sola vez.'
                }
            ]
        });
        setHelpModalVisible(true);
    };

    return (
        <View style={[commonStyles.modal.overlay, { paddingTop: insets.top }]}>
            <View style={[commonStyles.modal.content, {
                backgroundColor: theme.background.surface,
                width: '100%',
                maxWidth: 560,
                maxHeight: '95%',
                padding: 0,
                flex: 1,
            }]}>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.md,
                }}>
                    <Text style={{
                        fontSize: typography.size.lg,
                        fontWeight: '700',
                        color: theme.text.primary,
                    }}>
                        {t('calendar.bulk.title')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 4 }}
                    >
                        <Ionicons name="close" size={24} color={theme.text.primary} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentContainer, isDesktop && styles.contentContainerDesktop]}>
                        <View style={{ 
                            alignSelf: 'center', 
                            width: '90%', 
                            maxWidth: isDesktop ? 350 : 320, 
                            alignItems: 'flex-end', 
                            marginTop: 4,
                            marginBottom: -spacing.xs,
                        }}>
                            <HelpIcon onPress={showBulkHelp} size={16} />
                        </View>

                        <View style={{ 
                            flexDirection: 'row', 
                            marginBottom: spacing.lg, 
                            marginTop: spacing.sm, 
                            marginHorizontal: 'auto', 
                            maxWidth: 320,
                            width: '90%',
                            backgroundColor: theme.background.subtle, 
                            borderRadius: 12, 
                            padding: 4 
                        }}>
                            <TouchableOpacity
                                style={{ 
                                    flex: 1, 
                                    paddingVertical: 6, 
                                    alignItems: 'center', 
                                    borderRadius: 10, 
                                    backgroundColor: mode === 'roster' ? theme.components.button.primary.bg : 'transparent',
                                    shadowOpacity: mode === 'roster' ? 0.1 : 0,
                                    shadowRadius: 2,
                                    shadowOffset: { width: 0, height: 1 },
                                    elevation: mode === 'roster' ? 2 : 0
                                }}
                                onPress={() => setMode('roster')}
                            >
                                <Text style={{ fontWeight: '600', color: mode === 'roster' ? '#FFF' : theme.text.primary }}>{t('calendar.bulk.managePlayers')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ 
                                    flex: 1, 
                                    paddingVertical: 6, 
                                    alignItems: 'center', 
                                    borderRadius: 10, 
                                    backgroundColor: mode === 'delete' ? theme.status.error : 'transparent',
                                    shadowOpacity: mode === 'delete' ? 0.1 : 0,
                                    shadowRadius: 2,
                                    shadowOffset: { width: 0, height: 1 },
                                    elevation: mode === 'delete' ? 2 : 0
                                }}
                                onPress={() => setMode('delete')}
                            >
                                <Text style={{ fontWeight: '600', color: mode === 'delete' ? '#FFF' : theme.text.primary }}>{t('calendar.bulk.deleteClasses')}</Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'roster' && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg }}>
                                <View style={{ flexDirection: 'row', backgroundColor: theme.background.default, borderRadius: 20, borderWidth: 1, borderColor: theme.border.default, padding: 2 }}>
                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 32,
                                            paddingVertical: 8,
                                            borderRadius: 18,
                                            backgroundColor: rosterAction === 'add' ? theme.components.button.primary.bg : 'transparent',
                                            shadowOpacity: rosterAction === 'add' ? 0.15 : 0,
                                            shadowRadius: 2,
                                            shadowOffset: { width: 0, height: 1 },
                                            elevation: rosterAction === 'add' ? 3 : 0
                                        }}
                                        onPress={() => setRosterAction('add')}
                                    >
                                        <Text style={{ fontWeight: '700', color: rosterAction === 'add' ? '#FFF' : theme.text.primary }}>{t('calendar.bulk.add')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 32,
                                            paddingVertical: 8,
                                            borderRadius: 18,
                                            backgroundColor: rosterAction === 'remove' ? theme.status.error : 'transparent',
                                            shadowOpacity: rosterAction === 'remove' ? 0.15 : 0,
                                            shadowRadius: 2,
                                            shadowOffset: { width: 0, height: 1 },
                                            elevation: rosterAction === 'remove' ? 3 : 0
                                        }}
                                        onPress={() => setRosterAction('remove')}
                                    >
                                        <Text style={{ fontWeight: '700', color: rosterAction === 'remove' ? '#FFF' : theme.text.primary }}>{t('calendar.bulk.remove')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.filterContainer}>
                            <Text style={styles.sectionTitle}>{t('calendar.bulk.filters')}</Text>

                            <View style={styles.dateRow}>
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Ionicons name="calendar-outline" size={20} color={theme.text.secondary} />
                                    <Text style={styles.dateInputText}>
                                        {filters.startDate.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                <Ionicons name="arrow-forward" size={16} color={theme.text.tertiary} />
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setShowEndDatePicker(true)}
                                >
                                    <Ionicons name="calendar-outline" size={20} color={theme.text.secondary} />
                                    <Text style={styles.dateInputText}>
                                        {filters.endDate.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>{t('calendar.bulk.days')}</Text>
                            <View style={styles.daysRow}>
                                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => {
                                    const isExplicitlySelected = filters.daysOfWeek.includes(index);
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => toggleDay(index)}
                                            style={[styles.dayChip, isExplicitlySelected ? styles.dayChipSelected : styles.dayChipDefault]}
                                        >
                                            <Text style={[styles.dayChipText, isExplicitlySelected ? styles.dayChipTextSelected : styles.dayChipTextDefault]}>
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>{t('calendar.bulk.classType')}</Text>
                            <View style={[styles.daysRow, { marginBottom: spacing.md }]}>
                                {[
                                    { label: t('calendar.bulk.all'), value: 'all' },
                                    { label: t('calendar.bulk.individual'), value: 'individual' },
                                    { label: t('calendar.bulk.group'), value: 'group' }
                                ].map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        onPress={() => handleTypeChange(type.value as any)}
                                        style={[
                                            styles.dayChip,
                                            { paddingHorizontal: 16, width: 'auto' },
                                            filters.classType === type.value ? styles.dayChipSelected : styles.dayChipDefault
                                        ]}
                                    >
                                        <Text style={[styles.dayChipText, filters.classType === type.value ? styles.dayChipTextSelected : styles.dayChipTextDefault]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>{t('calendar.bulk.time')}</Text>
                            <View style={styles.timeFilterRow}>
                                <TouchableOpacity
                                    style={styles.timeInputContainer}
                                    onPress={() => setStartTimePickerVisible(true)}
                                >
                                    <Ionicons name="time-outline" size={20} color={theme.text.secondary} />
                                    <Text style={styles.timeInputText}>
                                        {filters.startTime}
                                    </Text>
                                </TouchableOpacity>

                                <Ionicons name="arrow-forward" size={16} color={theme.text.tertiary} />

                                <TouchableOpacity
                                    style={styles.timeInputContainer}
                                    onPress={() => setEndTimePickerVisible(true)}
                                >
                                    <Ionicons name="time-outline" size={20} color={theme.text.secondary} />
                                    <Text style={styles.timeInputText}>
                                        {filters.endTime}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.selectorsRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.selectorBtn,
                                        filters.groupId ? styles.selectorBtnActive : null,
                                        filters.classType === 'individual' && { opacity: 0.4 }
                                    ]}
                                    onPress={() => filters.classType !== 'individual' && setShowGroupPicker(true)}
                                    disabled={filters.classType === 'individual'}
                                >
                                    <Ionicons name="people-outline" size={20} color={filters.groupId ? theme.status.warning : theme.text.secondary} />
                                    <Text style={[styles.selectorBtnText, filters.groupId ? styles.selectorBtnTextActive : null]} numberOfLines={1}>
                                        {getSelectedGroupLabel()}
                                    </Text>
                                    {filters.groupId && (
                                        <TouchableOpacity onPress={() => updateFilter('groupId', null)} hitSlop={8}>
                                            <Ionicons name="close-circle" size={16} color={theme.text.tertiary} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.selectorBtn,
                                        ((mode === 'roster' && rosterAction === 'add' ? targetPlayerIds.length > 0 : filters.playerIds.length > 0)) ? styles.selectorBtnActive : null
                                    ]}
                                    onPress={() => setShowPlayerPicker(true)}
                                >
                                    <Ionicons
                                        name={mode === 'roster' && rosterAction === 'add' ? "person-add-outline" : "person-outline"}
                                        size={20}
                                        color={(mode === 'roster' && rosterAction === 'add' ? targetPlayerIds.length > 0 : filters.playerIds.length > 0) ? theme.status.warning : theme.text.secondary}
                                    />
                                    <Text style={[
                                        styles.selectorBtnText,
                                        ((mode === 'roster' && rosterAction === 'add' ? targetPlayerIds.length > 0 : filters.playerIds.length > 0)) ? styles.selectorBtnTextActive : null
                                    ]} numberOfLines={1}>
                                        {getSelectedPlayersLabel()}
                                    </Text>
                                    {(mode === 'roster' && rosterAction === 'add' ? targetPlayerIds.length > 0 : filters.playerIds.length > 0) && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (mode === 'roster' && rosterAction === 'add') {
                                                    setTargetPlayerIds([]);
                                                } else {
                                                    updateFilter('playerIds', []);
                                                }
                                            }}
                                            hitSlop={8}
                                        >
                                            <Ionicons name="close-circle" size={16} color={theme.text.tertiary} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.resultsHeader}>
                            <Text style={styles.resultsTitle}>
                                {t('calendar.bulk.resultsFound', { count: totalFound })}
                            </Text>
                        </View>

                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                            </View>
                        ) : (
                            <View style={styles.resultsList}>
                                {sessions.length > 0 ? (
                                    sessions.map((session) => (
                                        <View key={session.id} style={styles.sessionRow}>
                                            <View style={styles.dateBadge}>
                                                <Text style={styles.dateDay}>{new Date(session.scheduled_at).getDate()}</Text>
                                                <Text style={styles.dateMonth}>
                                                    {new Date(session.scheduled_at).toLocaleDateString(undefined, { month: 'short' })}
                                                </Text>
                                            </View>
                                            <View style={styles.sessionInfo}>
                                                <Text style={styles.sessionTime}>
                                                    {formatTime(session.scheduled_at)} - {(() => {
                                                        const d = new Date(session.scheduled_at);
                                                        d.setMinutes(d.getMinutes() + session.duration_minutes);
                                                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                                    })()}
                                                </Text>
                                                
                                                <View style={styles.metaRow}>
                                                    {session.coach && (
                                                        <View style={styles.metaBadge}>
                                                            <Ionicons name="school-outline" size={14} color={theme.text.primary} />
                                                            <Text style={styles.metaText}>{session.coach.full_name}</Text>
                                                        </View>
                                                    )}
                                                    <View style={styles.metaBadge}>
                                                        <Ionicons name="location-outline" size={14} color={theme.text.primary} />
                                                        <Text style={styles.metaText}>{session.court || session.location || t('calendar.bulk.noLocation')}</Text>
                                                    </View>
                                                </View>

                                                {session.players && session.players.length > 0 ? (
                                                    <Text style={styles.playersListText} numberOfLines={1}>
                                                        {session.players.map(p => p.full_name).join(', ')}
                                                    </Text>
                                                ) : (
                                                    <Text style={[styles.playersListText, { fontStyle: 'italic', color: theme.status.warning }]}>
                                                        {t('calendar.bulk.noPlayers')}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="search-outline" size={48} color={theme.text.disabled} />
                                        <Text style={styles.emptyText}>{t('calendar.bulk.noClassesFound')}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.footer}>
                            {!isAdmin ? (
                                <View style={styles.adminWarning}>
                                    <Ionicons name="lock-closed-outline" size={16} color={theme.text.secondary} />
                                    <Text style={styles.adminWarningText}>{t('calendar.bulk.adminOnly')}</Text>
                                </View>
                            ) : (
                                <View style={styles.actionGrid}>
                                    {mode === 'roster' ? (
                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtn,
                                                {
                                                    backgroundColor: rosterAction === 'add' ? theme.components.button.primary.bg : theme.background.subtle,
                                                    borderColor: rosterAction === 'add' ? theme.components.button.primary.bg : theme.border.default,
                                                    minWidth: 200,
                                                    paddingHorizontal: 30,
                                                    alignSelf: 'center'
                                                },
                                                (totalFound === 0 || isProcessing) && styles.disabledBtn
                                            ]}
                                            onPress={() => handleActionPress(rosterAction === 'add' ? 'add_players' : 'remove_players')}
                                            disabled={totalFound === 0 || isProcessing}
                                        >
                                            <Text style={[styles.actionBtnText, { color: rosterAction === 'add' ? '#FFF' : theme.text.primary }]}>
                                                {rosterAction === 'add'
                                                    ? (targetPlayerIds.length > 0 ? t('calendar.bulk.addPlayersCount', { count: targetPlayerIds.length }) : t('calendar.bulk.addPlayers'))
                                                    : (filters.playerIds.length > 0 ? t('calendar.bulk.removePlayersCount', { count: filters.playerIds.length }) : t('calendar.bulk.removePlayers'))
                                                }
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.deleteBtn, (totalFound === 0 || isProcessing) && styles.disabledBtn, { minWidth: 200, paddingHorizontal: 30, alignSelf: 'center' }]}
                                            onPress={() => handleActionPress('delete')}
                                            disabled={totalFound === 0 || isProcessing}
                                        >
                                            <Text style={[styles.actionBtnText, { color: theme.status.error }]}>
                                                {t('calendar.bulk.deleteClassesCount', { count: totalFound })}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </View>

            <Modal
                visible={showGroupPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowGroupPicker(false)}
            >
                <View style={[commonStyles.modal.overlay, { paddingTop: insets.top }]}>
                    <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>{t('calendar.bulk.selectGroup')}</Text>
                            <TouchableOpacity onPress={() => setShowGroupPicker(false)}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={groups || []}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.pickerItem, filters.groupId === item.id && styles.pickerItemSelected]}
                                    onPress={() => {
                                        updateFilter('groupId', item.id);
                                        setShowGroupPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, filters.groupId === item.id && styles.pickerItemTextSelected]}>
                                        {item.name}
                                    </Text>
                                    {filters.groupId === item.id && <Ionicons name="checkmark" size={20} color={theme.components.button.primary.bg} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showPlayerPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowPlayerPicker(false)}
            >
                <View style={[commonStyles.modal.overlay, { paddingTop: insets.top }]}>
                    <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>{t('calendar.bulk.filterByPlayer')}</Text>
                            <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Input
                            placeholder={t('calendar.bulk.searchPlayer')}
                            value={playerSearch}
                            onChangeText={setPlayerSearch}
                            containerStyle={{ margin: spacing.md }}
                        />
                        <FlatList
                            data={filteredPlayers}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const isSelected = (mode === 'roster' && rosterAction === 'add')
                                    ? targetPlayerIds.includes(item.id)
                                    : filters.playerIds.includes(item.id);
                                return (
                                    <TouchableOpacity
                                        style={[styles.playerItem, isSelected && styles.playerItemSelected]}
                                        onPress={() => {
                                            if (mode === 'roster' && rosterAction === 'add') {
                                                setTargetPlayerIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
                                            } else {
                                                updateFilter('playerIds', filters.playerIds.includes(item.id) ? filters.playerIds.filter(id => id !== item.id) : [...filters.playerIds, item.id]);
                                            }
                                        }}
                                    >
                                        <Avatar size="sm" name={item.full_name} source={item.profile_image_url || undefined} />
                                        <Text style={[styles.playerItemName, isSelected && styles.playerItemNameSelected]}>{item.full_name}</Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.components.button.primary.bg} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <Button label={t('calendar.bulk.done')} onPress={() => setShowPlayerPicker(false)} style={{ margin: spacing.md }} />
                    </View>
                </View>
            </Modal>

            <Modal
                visible={confirmModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={[commonStyles.modal.overlay, { paddingTop: insets.top }]}>
                    <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>
                        <View style={styles.warningHeader}>
                            <Ionicons
                                name={selectedAction === 'add_players' ? "person-add" : "warning"}
                                size={32}
                                color={selectedAction === 'add_players' ? theme.components.button.primary.bg : theme.status.error}
                            />
                            <Text style={styles.warningTitle}>
                                {selectedAction === 'delete' ? '¿Confirmar Borrado?' :
                                    selectedAction === 'remove_players' ? '¿Confirmar Eliminación?' :
                                        '¿Confirmar Agregado?'}
                            </Text>
                        </View>
                        <Text style={styles.modalMessage}>
                            {selectedAction === 'delete' ? (
                                <>
                                    <Text style={{ fontWeight: '700', color: theme.status.error }}>BORRAR {totalFound} CLASES.</Text>
                                    {"\n"}
                                    Se eliminarán para <Text style={{ textDecorationLine: 'underline' }}>TODOS</Text> los alumnos.
                                </>
                            ) : selectedAction === 'remove_players' ? (
                                <>
                                    Eliminar a <Text style={{ fontWeight: '700' }}>{getSelectedPlayersLabel()}</Text> de {totalFound} clases.
                                    {"\n"}
                                    <Text style={[typography.variants.bodySmall, { color: theme.status.warning }]}>
                                        (Solo clases futuras, mantiene historial)
                                    </Text>
                                </>
                            ) : (
                                <>
                                    Agregar a <Text style={{ fontWeight: '700' }}>{getSelectedPlayersLabel()}</Text> en {totalFound} clases.
                                    {"\n"}
                                    <Text style={[typography.variants.bodySmall, { color: theme.components.button.primary.bg }]}>
                                        (Se ignorarán duplicados si ya están inscritos)
                                    </Text>
                                </>
                            )}
                            {"\n\n"}
                            {(confirmModalVisible && hasCriticalSessions && (selectedAction === 'delete' || selectedAction === 'remove_players')) && (
                                <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <Ionicons name="checkmark-circle-outline" size={14} color={theme.text.secondary} style={{ marginRight: 6 }} />
                                        <Text style={[typography.variants.bodyMedium, { color: theme.text.secondary }]}>
                                            {'>'} 24hs: Se borran sin afectar la cuenta. </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.status.error + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                                        <Ionicons name="alert-circle" size={16} color={theme.status.error} style={{ marginRight: 6 }} />
                                        <Text style={[typography.variants.label, { color: theme.status.error }]}>
                                            {'<'} 24hs: Se cancelan y AFECTA la cuenta.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </Text>
                        {selectedAction === 'delete' && (
                            <Input label="Motivo (Opcional)" placeholder="Ej. Lluvia..." value={cancellationReason} onChangeText={setCancellationReason} />
                        )}
                        <View style={styles.modalActions}>
                            <Button variant="ghost" label="Cancelar" onPress={() => setConfirmModalVisible(false)} style={{ flex: 1 }} />
                            <Button variant="primary" label={isProcessing ? "Procesando..." : "Confirmar"} onPress={confirmAction} loading={isProcessing} style={{ flex: 1, marginLeft: spacing.md, backgroundColor: selectedAction === 'add_players' ? theme.components.button.primary.bg : theme.status.error }} />
                        </View>
                    </View>
                </View>
            </Modal>

            <DatePickerModal visible={showStartDatePicker} onClose={() => setShowStartDatePicker(false)} selectedDate={filters.startDate} onSelect={(d) => updateFilter('startDate', d)} />
            <DatePickerModal visible={showEndDatePicker} onClose={() => setShowEndDatePicker(false)} selectedDate={filters.endDate} onSelect={(d) => updateFilter('endDate', d)} />
            <TimePickerModal visible={startTimePickerVisible} onClose={() => setStartTimePickerVisible(false)} onSelect={(h, m) => handleTimeSelect(h, m, 'start')} selectedTime={new Date()} />
            <TimePickerModal visible={endTimePickerVisible} onClose={() => setEndTimePickerVisible(false)} onSelect={(h, m) => handleTimeSelect(h, m, 'end')} selectedTime={new Date()} />

            <Modal visible={showPlanAssignment} transparent animationType="slide" onRequestClose={() => setShowPlanAssignment(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: isDesktop ? '70%' : '85%', maxHeight: 700, width: isDesktop ? 600 : '95%' }]}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>{t('calendar.bulk.reviewTitle')}</Text>
                                <Text style={[typography.variants.bodySmall, { color: theme.text.tertiary, marginTop: 2 }]}>{t('calendar.bulk.reviewSubtitle')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowPlanAssignment(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
                            {(players || []).filter((p: any) => targetPlayerIds.includes(p.id)).map((player: any) => {
                                const activeSubs = player.active_subscriptions || [];
                                const currentPlanId = playerPlanMap[player.id];
                                const effectivePlanId = currentPlanId || (activeSubs.length === 1 ? activeSubs[0].plan.id : null);
                                if (effectivePlanId && !currentPlanId) setPlayerPlanMap(prev => ({ ...prev, [player.id]: effectivePlanId }));
                                return (
                                    <View key={player.id} style={{ marginBottom: spacing.md, backgroundColor: theme.background.subtle, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: theme.border.default }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                                            <Avatar name={player.full_name} size="sm" />
                                            <Text style={[typography.variants.label, { marginLeft: spacing.sm, flex: 1, color: theme.text.primary }]}>{player.full_name}</Text>
                                        </View>
                                        {activeSubs.length === 0 ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons name="alert-circle" size={16} color={theme.status.error} />
                                                <Text style={[typography.variants.bodySmall, { color: theme.status.error }]}>{t('calendar.bulk.noActivePlans')}</Text>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                                                {activeSubs.map((sub: any) => {
                                                    const isActive = effectivePlanId === sub.plan.id;
                                                    return (
                                                        <TouchableOpacity key={sub.id} style={[styles.planChip, isActive && styles.planChipActive]} onPress={() => setPlayerPlanMap(prev => ({ ...prev, [player.id]: sub.plan.id }))}>
                                                            <Ionicons name={isActive ? "checkmark-circle" : "ellipse-outline"} size={16} color={isActive ? theme.components.button.primary.bg : theme.text.tertiary} />
                                                            <Text style={[styles.planChipText, isActive && styles.planChipTextActive]}>{sub.plan.name}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                        <View style={[styles.footer, { padding: spacing.md, borderTopWidth: 0 }]}>
                            <Button label={t('calendar.bulk.confirmSelection')} onPress={() => { setShowPlanAssignment(false); setConfirmModalVisible(true); }} disabled={targetPlayerIds.some((pid: string) => {
                                const p = (players || []).find((x: any) => x.id === pid);
                                const subs = p?.active_subscriptions || [];
                                return subs.length > 0 && !playerPlanMap[pid] && subs.length !== 1;
                            })} />
                        </View>
                    </View>
                </View>
            </Modal>

            <HelpModal visible={helpModalVisible} onClose={() => setHelpModalVisible(false)} title={helpModalConfig.title} items={helpModalConfig.items} />
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background.default },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    contentContainer: { flex: 1, width: '100%', backgroundColor: theme.background.surface },
    contentContainerDesktop: { maxWidth: 500, alignSelf: 'center', backgroundColor: theme.background.surface, borderRadius: 12, marginVertical: spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, overflow: 'hidden', minHeight: 600 },
    filterContainer: { padding: spacing.md, backgroundColor: theme.background.surface, borderBottomWidth: 0 },
    sectionTitle: { ...typography.variants.labelSmall, color: theme.text.primary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.subtle, padding: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: theme.border.default, gap: spacing.sm },
    dateInputText: { ...typography.variants.bodyLarge, color: theme.text.primary, fontWeight: '500' },
    daysRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
    timeFilterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    timeInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.subtle, borderRadius: 8, padding: spacing.sm, borderWidth: 1, borderColor: theme.border.default, gap: spacing.sm },
    timeInputText: { ...typography.variants.bodyLarge, color: theme.text.primary, fontWeight: '500' },
    dayChip: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background.surface, borderWidth: 1, borderColor: theme.border.default },
    dayChipDefault: { borderColor: theme.border.default, backgroundColor: theme.background.subtle },
    dayChipSelected: { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg },
    dayChipText: { ...typography.variants.labelSmall },
    dayChipTextDefault: { color: theme.text.primary },
    dayChipTextSelected: { color: theme.text.inverse },
    selectorsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    selectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, backgroundColor: theme.background.subtle, borderRadius: 8, borderWidth: 1, borderColor: theme.border.default, gap: 6, height: 42 },
    selectorBtnActive: { backgroundColor: theme.status.warning + '15', borderColor: theme.status.warning + '40' },
    selectorBtnText: { ...typography.variants.bodyMedium, color: theme.text.primary, fontWeight: '500', flexShrink: 1 },
    selectorBtnTextActive: { color: theme.status.warning, fontWeight: '600' },
    tabButtonText: { ...typography.variants.bodyMedium, fontWeight: '600', color: theme.text.primary },
    chipText: { ...typography.variants.labelSmall, color: theme.text.primary },
    resultsHeader: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: theme.background.surface, borderBottomWidth: 0 },
    resultsTitle: { ...typography.variants.bodyMedium, color: theme.text.primary },
    resultsList: { minHeight: 200, backgroundColor: theme.background.surface },
    listContent: { padding: spacing.md, paddingBottom: 100 },
    loadingContainer: { padding: spacing.xl, alignItems: 'center' },
    emptyContainer: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.sm },
    emptyText: { ...typography.variants.bodyLarge, color: theme.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
    sessionRow: { flexDirection: 'row', backgroundColor: theme.background.surface, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm, borderWidth: 0 },
    dateBadge: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60, backgroundColor: theme.background.default, borderRadius: 12, marginRight: spacing.md, borderWidth: 0, padding: 4 },
    dateDay: { ...typography.variants.h3, color: theme.text.primary, lineHeight: 22 },
    dateMonth: { ...typography.variants.labelSmall, textTransform: 'uppercase', color: theme.text.primary, fontWeight: '700', marginTop: -2 },
    sessionInfo: { flex: 1, justifyContent: 'center' },
    sessionTime: { ...typography.variants.labelSmall, color: theme.text.primary },
    sessionTitle: { ...typography.variants.bodyMedium, fontWeight: '700', color: theme.text.primary, marginBottom: 4 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
    metaText: { ...typography.variants.labelSmall, color: theme.text.primary },
    playersListText: { ...typography.variants.bodySmall, color: theme.text.primary, marginTop: 4 },
    footer: { padding: spacing.md, backgroundColor: theme.background.surface, borderTopWidth: 0 },
    adminWarning: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: theme.background.subtle, borderRadius: 8, gap: 8 },
    adminWarningText: { color: theme.text.tertiary, fontSize: typography.size.sm },
    actionGrid: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: 12, borderWidth: 1, gap: 8 },
    editBtn: { backgroundColor: theme.background.subtle, borderColor: theme.border.default },
    deleteBtn: { backgroundColor: theme.status.error + '15', borderColor: theme.status.error + '40' },
    disabledBtn: { backgroundColor: theme.background.subtle, borderColor: theme.border.default, opacity: 0.6 },
    actionBtnText: { fontWeight: '600', fontSize: typography.size.sm, color: theme.text.primary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: theme.background.surface, borderRadius: 16, width: '90%', maxWidth: 500, overflow: 'hidden' },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0 },
    modalTitle: { fontSize: typography.size.lg, fontWeight: '700', color: theme.text.primary },
    warningHeader: { alignItems: 'center', marginBottom: spacing.md },
    warningTitle: { fontSize: typography.size.xl, fontWeight: '700', color: theme.text.primary, marginTop: spacing.sm },
    modalMessage: { fontSize: typography.size.md, color: theme.text.primary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },
    modalActions: { flexDirection: 'row', marginTop: spacing.md },
    pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 0 },
    pickerItemSelected: { backgroundColor: theme.components.button.primary.bg + '15' },
    pickerItemText: { fontSize: typography.size.md, color: theme.text.primary },
    pickerItemTextSelected: { color: theme.components.button.primary.bg, fontWeight: '600' },
    playerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 0 },
    playerItemName: { flex: 1, marginLeft: spacing.md, fontSize: typography.size.md, color: theme.text.primary },
    playerItemSelected: { backgroundColor: theme.components.button.primary.bg + '15' },
    playerItemNameSelected: { color: theme.components.button.primary.bg, fontWeight: '600' },
    planChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: theme.background.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border.default, gap: 8, marginRight: 4, marginBottom: 8, minHeight: 36 },
    planChipActive: { backgroundColor: theme.components.button.primary.bg + '15', borderColor: theme.components.button.primary.bg },
    planChipText: { ...typography.variants.labelSmall, color: theme.text.primary, fontWeight: '500' },
    planChipTextActive: { color: theme.components.button.primary.bg, fontWeight: '700' },
});
