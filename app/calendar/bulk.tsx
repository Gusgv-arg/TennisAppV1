import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Session } from '@/src/types/session';
import { showError, showInfo } from '@/src/utils/toast';

export default function BulkActionsScreen() {
    const router = useRouter();
    const { profile } = useAuthStore();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const isAdmin = profile?.role === 'coach'; // In this version, coaches are admins/owners
    const { theme } = useTheme();
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

    // Status Modal (Only for Confirmations now, removing showStatus helper)

    // Helpers
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
            showInfo('Sin clases', 'No hay clases seleccionadas para esta acción.');
            return;
        }

        if (action === 'add_players') {
            if (targetPlayerIds.length === 0) {
                showInfo('Seleccionar Alumnos', 'Selecciona los alumnos que deseas AGREGAR a estas clases.');
                return;
            }
            setSelectedAction('add_players');
            setConfirmModalVisible(true);
            return;
        }

        if (action === 'remove_players') {
            if (filters.playerIds.length === 0) {
                showInfo('Seleccionar Alumnos', 'Selecciona los alumnos que deseas QUITAR de estas clases.');
                return;
            }
            setSelectedAction('remove_players');
            // Remove players doesn't need specific reason but we keep it compatible
            setCancellationReason('Eliminación de alumnos');
            setConfirmModalVisible(true);
            return;
        }
        if (action === 'delete') {
            if (!isAdmin) {
                showError('Acceso Denegado', 'Solo los administradores pueden realizar borrados masivos.');
                return;
            }

            // Check if filtering by player
            if (filters.playerIds.length > 0) {
                // Ask user intention
                Alert.alert(
                    'Acción de Borrado',
                    `Has seleccionado ${filters.playerIds.length} alumno(s). ¿Qué deseas hacer?`,
                    [
                        {
                            text: 'Cancelar',
                            style: 'cancel'
                        },
                        {
                            text: 'Eliminar Alumnos de las Clases',
                            onPress: () => {
                                setSelectedAction('remove_players');
                                setCancellationReason('Eliminación de alumnos');
                                setConfirmModalVisible(true);
                            }
                        },
                        {
                            text: 'BORRAR CLASES COMPLETAS',
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
            Alert.alert('Próximamente', 'La edición masiva estará disponible en breve.');
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
                // Success handled by hook (Toast)
            } else if (selectedAction === 'remove_players') {
                await removePlayersFromSessionsBulk.mutateAsync({
                    sessionIds,
                    playerIds: filters.playerIds // Uses filter selection
                });
                // Success handled by hook (Toast)
            } else if (selectedAction === 'add_players') {
                await addPlayersToSessionsBulk.mutateAsync({
                    sessionIds,
                    playerIds: targetPlayerIds // Uses target selection
                });
                // Success handled by hook (Toast)
            }

            // Return to calendar after success
            router.back();
        } catch (error) {
            console.error(error);
            // Error handled by hook (Toast)
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
        return (players || []).filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()));
    }, [players, playerSearch]);

    const getSelectedPlayersLabel = () => {
        if (mode === 'roster' && rosterAction === 'add') {
            if (targetPlayerIds.length === 0) return 'Agregar Alumnos';
            if (targetPlayerIds.length === 1) {
                return players?.find(p => p.id === targetPlayerIds[0])?.full_name || '1 Alumno';
            }
            return `${targetPlayerIds.length} Alumnos (Agregar)`;
        }

        if (filters.playerIds.length === 0) {
            return (mode === 'roster' && rosterAction === 'remove') ? 'Eliminar Alumnos' : 'Filtrar por Alumno';
        }
        if (filters.playerIds.length === 1) {
            return players?.find(p => p.id === filters.playerIds[0])?.full_name || '1 Alumno';
        }
        return `${filters.playerIds.length} Alumnos`;
    };

    const getSelectedGroupLabel = () => {
        if (!filters.groupId) return 'Filtrar por Grupo';
        return groups?.find(g => g.id === filters.groupId)?.name || 'Grupo Seleccionado';
    };

    // Render Items
    const renderSessionItem = ({ item }: { item: Session }) => {
        const hasGroup = !!item.class_group;
        const attendees = item.players || [];

        return (
            <View style={styles.sessionRow}>
                <View style={styles.dateBadge}>
                    <Text style={styles.dateDay}>{new Date(item.scheduled_at).getDate()}</Text>
                    <Text style={styles.dateMonth}>
                        {new Date(item.scheduled_at).toLocaleDateString(undefined, { month: 'short' })}
                    </Text>
                </View>
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTime}>
                        {formatTime(item.scheduled_at)} • {item.duration_minutes}m
                    </Text>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                        {item.class_group?.name
                            ? `${item.class_group.name} (${attendees.length})`
                            : (attendees.length > 0 ? attendees.map(p => p.full_name).join(', ') : 'Sin alumnos')
                        }
                    </Text>
                    <View style={styles.metaRow}>
                        {item.coach && (
                            <View style={styles.metaBadge}>
                                <Ionicons name="person-outline" size={12} color={theme.text.secondary} />
                                <Text style={styles.metaText}>{item.coach.full_name}</Text>
                            </View>
                        )}
                        {item.court && (
                            <View style={styles.metaBadge}>
                                <Ionicons name="location-outline" size={12} color={theme.text.secondary} />
                                <Text style={styles.metaText}>{item.court}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    return (
        <View style={commonStyles.modal.overlay}>
            <View style={[commonStyles.modal.content, {
                backgroundColor: theme.background.surface,
                width: '100%',
                maxWidth: 800, // Wide for bulk actions
                maxHeight: '95%',
                padding: 0
            }]}>
                {/* Custom Modal Header */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border.default,
                }}>
                    <Text style={{
                        fontSize: typography.size.lg,
                        fontWeight: '700',
                        color: theme.text.primary,
                    }}>
                        Edición Masiva
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



                        {/* MODE TABS */}
                        <View style={{ flexDirection: 'row', marginBottom: spacing.lg, marginTop: spacing.lg, marginHorizontal: spacing.xl, backgroundColor: theme.background.subtle, borderRadius: 12, padding: 4 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: mode === 'roster' ? theme.components.button.primary.bg : 'transparent', shadowOpacity: mode === 'roster' ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: mode === 'roster' ? 2 : 0 }}
                                onPress={() => setMode('roster')}
                            >
                                <Text style={{ fontWeight: '600', color: mode === 'roster' ? '#FFF' : theme.text.tertiary }}>Gestionar Alumnos</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: mode === 'delete' ? theme.status.error : 'transparent', shadowOpacity: mode === 'delete' ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: mode === 'delete' ? 2 : 0 }}
                                onPress={() => setMode('delete')}
                            >
                                <Text style={{ fontWeight: '600', color: mode === 'delete' ? '#FFF' : theme.text.tertiary }}>Borrar Clases</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ROSTER ACTIONS SUB-SWITCH */}
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
                                        <Text style={{ fontWeight: '700', color: rosterAction === 'add' ? '#FFF' : theme.text.tertiary }}>Agregar</Text>
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
                                        <Text style={{ fontWeight: '700', color: rosterAction === 'remove' ? '#FFF' : theme.text.tertiary }}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Filters Section */}
                        <View style={styles.filterContainer}>
                            <Text style={styles.sectionTitle}>Filtros</Text>

                            {/* Date Range */}
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

                            {/* Days of Week */}
                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Días</Text>
                            <View style={styles.daysRow}>
                                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => {
                                    const isSelected = filters.daysOfWeek.includes(index) || (filters.daysOfWeek.length === 0);
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

                            {/* Class Type */}
                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Tipo de Clase</Text>
                            <View style={[styles.daysRow, { marginBottom: spacing.md }]}>
                                {[
                                    { label: 'Todas', value: 'all' },
                                    { label: 'Individuales', value: 'individual' },
                                    { label: 'Grupales', value: 'group' }
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

                            {/* Time Filter */}
                            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Hora</Text>
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

                            {/* Selectors */}
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
                                    <Ionicons name="people-outline" size={20} color={filters.groupId ? theme.components.button.primary.bg : theme.text.secondary} />
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
                                        color={(mode === 'roster' && rosterAction === 'add' ? targetPlayerIds.length > 0 : filters.playerIds.length > 0) ? theme.components.button.primary.bg : theme.text.secondary}
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

                        {/* Results Section */}
                        <View style={styles.resultsHeader}>
                            <Text style={styles.resultsTitle}>
                                Resultados encontrados ({totalFound})
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
                                                    {formatTime(session.scheduled_at)} • {session.duration_minutes}m
                                                </Text>

                                                <Text style={styles.sessionTitle} numberOfLines={1}>
                                                    {session.class_group?.name || 'Clase Individual'}
                                                </Text>

                                                <View style={styles.metaRow}>
                                                    <View style={styles.metaBadge}>
                                                        <Ionicons name="location-outline" size={10} color={theme.text.secondary} />
                                                        <Text style={styles.metaText}>{session.court || session.location || 'Sin ubicación'}</Text>
                                                    </View>
                                                    <View style={styles.metaBadge}>
                                                        <Ionicons name="person-outline" size={10} color={theme.text.secondary} />
                                                        <Text style={styles.metaText}>{session.players?.length || 0} Alumnos</Text>
                                                    </View>
                                                </View>

                                                {/* Players List Preview */}
                                                {session.players && session.players.length > 0 ? (
                                                    <Text style={styles.playersListText} numberOfLines={1}>
                                                        {session.players.map(p => p.full_name).join(', ')}
                                                    </Text>
                                                ) : (
                                                    <Text style={[styles.playersListText, { fontStyle: 'italic', color: theme.status.warning }]}>
                                                        Sin alumnos
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="search-outline" size={48} color={theme.text.disabled} />
                                        <Text style={styles.emptyText}>No se encontraron clases con estos filtros.</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Actions Footer */}
                        <View style={styles.footer}>
                            {!isAdmin ? (
                                <View style={styles.adminWarning}>
                                    <Ionicons name="lock-closed-outline" size={16} color={theme.text.secondary} />
                                    <Text style={styles.adminWarningText}>Solo administradores pueden realizar acciones masivas.</Text>
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
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <Ionicons
                                                    name={rosterAction === 'add' ? "person-add-outline" : "person-remove-outline"}
                                                    size={20}
                                                    color="#FFF"
                                                />
                                            )}
                                            <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                                                {rosterAction === 'add'
                                                    ? (targetPlayerIds.length > 0 ? `Agregar ${targetPlayerIds.length} Alumnos` : 'Agregar Alumnos')
                                                    : (filters.playerIds.length > 0 ? `Eliminar ${filters.playerIds.length} Alumnos` : 'Eliminar Alumnos')
                                                }
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.deleteBtn, (totalFound === 0 || isProcessing) && styles.disabledBtn, { minWidth: 200, paddingHorizontal: 30, alignSelf: 'center' }]}
                                            onPress={() => handleActionPress('delete')}
                                            disabled={totalFound === 0 || isProcessing}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color={theme.status.error} />
                                            ) : (
                                                <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                            )}
                                            <Text style={[styles.actionBtnText, { color: theme.status.error }]}>
                                                {`Borrar ${totalFound} Clases`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                    </View>
                </ScrollView>
            </View>

            {/* Group Picker Modal */}
            <Modal
                visible={showGroupPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowGroupPicker(false)}
            >
                <View style={commonStyles.modal.overlay}>
                    <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>
                        <View style={[styles.modalHeaderRow, { borderBottomColor: theme.border.default }]}>
                            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Seleccionar Grupo</Text>
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

            {/* Player Picker Modal */}
            <Modal
                visible={showPlayerPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowPlayerPicker(false)}
            >
                <View style={commonStyles.modal.overlay}>
                    <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>
                        <View style={[styles.modalHeaderRow, { borderBottomColor: theme.border.default }]}>
                            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Filtrar por Alumno</Text>
                            <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <Input
                            placeholder="Buscar alumno..."
                            value={playerSearch}
                            onChangeText={setPlayerSearch}
                            containerStyle={{ marginBottom: spacing.md }}
                            leftIcon={<Ionicons name="search" size={20} color={theme.text.tertiary} />}
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
                                                setTargetPlayerIds(prev =>
                                                    prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                                );
                                            } else {
                                                updateFilter('playerIds',
                                                    filters.playerIds.includes(item.id)
                                                        ? filters.playerIds.filter(id => id !== item.id)
                                                        : [...filters.playerIds, item.id]
                                                );
                                            }
                                        }}
                                    >
                                        <Avatar
                                            size="sm"
                                            name={item.full_name}
                                            source={item.profile_image_url || undefined}
                                        />
                                        <Text style={[styles.playerItemName, isSelected && styles.playerItemNameSelected]}>
                                            {item.full_name}
                                        </Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.components.button.primary.bg} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <Button
                            label="Listo"
                            onPress={() => setShowPlayerPicker(false)}
                            style={{ marginTop: spacing.md }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                visible={confirmModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={commonStyles.modal.overlay}>
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
                                            &lt; 24hs: Se cancelan y AFECTA la cuenta.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </Text>

                        {selectedAction === 'delete' && (
                            <Input
                                label="Motivo (Opcional)"
                                placeholder="Ej. Lluvia..."
                                value={cancellationReason}
                                onChangeText={setCancellationReason}
                                containerStyle={{ marginTop: spacing.sm }}
                            />
                        )}

                        <View style={styles.modalActions}>
                            <Button
                                variant="ghost"
                                label="Cancelar"
                                onPress={() => setConfirmModalVisible(false)}
                                labelStyle={{ color: theme.text.secondary, fontWeight: '600' }}
                                style={{
                                    flex: 1,
                                    backgroundColor: theme.background.subtle,
                                    borderColor: 'transparent'
                                }}
                            />
                            <Button
                                variant="primary"
                                label={isProcessing ? "Procesando..." : "Confirmar"}
                                onPress={confirmAction}
                                loading={isProcessing}
                                style={{
                                    flex: 1,
                                    marginLeft: spacing.md,
                                    backgroundColor: selectedAction === 'add_players' ? theme.components.button.primary.bg : theme.status.error
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Date Pickers */}
            <DatePickerModal
                visible={showStartDatePicker}
                onClose={() => setShowStartDatePicker(false)}
                selectedDate={filters.startDate}
                onSelect={(d) => updateFilter('startDate', d)}
            />
            <DatePickerModal
                visible={showEndDatePicker}
                onClose={() => setShowEndDatePicker(false)}
                selectedDate={filters.endDate}
                onSelect={(d) => updateFilter('endDate', d)}
            />

            <TimePickerModal
                visible={startTimePickerVisible}
                onClose={() => setStartTimePickerVisible(false)}
                onSelect={(h: number, m: number) => handleTimeSelect(h, m, 'start')}
                selectedTime={(() => {
                    const d = new Date();
                    const [h, m] = filters.startTime.split(':').map(Number);
                    d.setHours(h, m, 0, 0);
                    return d;
                })()}
            />

            <TimePickerModal
                visible={endTimePickerVisible}
                onClose={() => setEndTimePickerVisible(false)}
                onSelect={(h: number, m: number) => handleTimeSelect(h, m, 'end')}
                selectedTime={(() => {
                    const d = new Date();
                    const [h, m] = filters.endTime.split(':').map(Number);
                    d.setHours(h, m, 0, 0);
                    return d;
                })()}
            />
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        // Center content for desktop if needed, though main container handles it
    },
    contentContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: theme.background.default,
    },
    contentContainerDesktop: {
        maxWidth: 500,
        alignSelf: 'center',
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        // Add vertical margins for better look on big screens
        marginVertical: spacing.md,
        // Box Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        // Ensure footer doesn't break out
        overflow: 'hidden',
        minHeight: 600, // Minimal height to look good
    },
    filterContainer: {
        padding: spacing.md,
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.default,
    },
    sectionTitle: {
        ...typography.variants.labelSmall,
        color: theme.text.tertiary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // --- Date Inputs ---
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    dateInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center content
        backgroundColor: theme.background.default,
        padding: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border.default,
        gap: spacing.sm,
    },
    dateInputText: {
        ...typography.variants.bodyLarge,
        color: theme.text.primary,
        fontWeight: '500',
    },

    // --- Days Chips ---
    daysRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    timeFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    timeInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background.default,
        borderRadius: 8,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: theme.border.default,
        gap: spacing.sm,
    },
    timeInputText: {
        ...typography.variants.bodyLarge,
        color: theme.text.primary,
        fontWeight: '500',
    },
    dayChip: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    dayChipDefault: {
        borderColor: theme.border.default,
        backgroundColor: theme.background.default,
    },
    dayChipSelected: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    dayChipText: {
        ...typography.variants.labelSmall,
    },
    dayChipTextDefault: {
        color: theme.text.tertiary,
    },
    dayChipTextSelected: {
        color: theme.text.inverse,
    },

    // --- Selectors ---
    selectorsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    selectorBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        backgroundColor: theme.background.default,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border.default,
        gap: 6,
        height: 42,
    },
    selectorBtnActive: {
        backgroundColor: theme.components.button.primary.bg + '15',
        borderColor: theme.components.button.primary.bg + '40',
    },
    selectorBtnText: {
        ...typography.variants.bodyMedium,
        color: theme.text.secondary,
        fontWeight: '500',
        flexShrink: 1,
    },
    selectorBtnTextActive: {
        color: theme.components.button.primary.bg,
        fontWeight: '600',
    },

    // --- Results List ---
    resultsHeader: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: theme.background.default,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.default,
    },
    resultsTitle: {
        ...typography.variants.bodyMedium,
        color: theme.text.secondary,
    },
    resultsList: {
        minHeight: 200,
        backgroundColor: theme.background.default,
    },
    listContent: {
        padding: spacing.md,
        // Add enough padding at bottom for footer
        paddingBottom: 100,
    },
    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: spacing.xl,
        marginTop: spacing.sm,
    },
    emptyText: {
        ...typography.variants.bodyLarge,
        color: theme.text.tertiary,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    sessionRow: {
        flexDirection: 'row',
        backgroundColor: theme.background.surface,
        padding: spacing.sm,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: theme.border.default,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    dateBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        backgroundColor: theme.background.default,
        borderRadius: 10,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    dateDay: {
        ...typography.variants.h3,
        color: theme.text.primary,
        lineHeight: 22,
    },
    dateMonth: {
        ...typography.variants.labelSmall,
        color: theme.text.tertiary,
        textTransform: 'uppercase',
    },
    sessionInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    sessionTime: {
        ...typography.variants.labelSmall,
        color: theme.components.button.primary.bg,
        marginBottom: 2,
    },
    sessionTitle: {
        ...typography.variants.label,
        color: theme.text.primary,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: theme.background.subtle,
        borderRadius: 4,
    },
    metaText: {
        ...typography.variants.labelSmall,
        color: theme.text.secondary,
    },
    playersListText: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        marginTop: 4,
    },

    // --- Footer ---
    footer: {
        padding: spacing.md,
        backgroundColor: theme.background.surface,
        borderTopWidth: 1,
        borderTopColor: theme.border.default,
    },
    adminWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        backgroundColor: theme.background.default,
        borderRadius: 8,
        gap: 8,
    },
    adminWarningText: {
        color: theme.text.tertiary,
        fontSize: typography.size.sm,
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'center', // Center buttons
        gap: spacing.md,
        marginTop: spacing.md, // Add some top spacing
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    editBtn: {
        backgroundColor: theme.background.subtle,
        borderColor: theme.border.default,
    },
    deleteBtn: {
        backgroundColor: theme.status.error + '15',
        borderColor: theme.status.error + '40',
    },
    disabledBtn: {
        backgroundColor: theme.background.subtle,
        borderColor: theme.border.default,
        opacity: 0.6,
    },
    actionBtnText: {
        fontWeight: '600',
        fontSize: typography.size.sm,
    },

    // --- Modals --- (Redundant styles removed: modalOverlay, modalContent, etc.)
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        // Border color applied via theme
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    warningHeader: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    warningTitle: { // formerly modalTitle for warning
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.text.primary,
        marginTop: spacing.sm,
    },
    modalMessage: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: spacing.md, // Reduced from lg
    },
    // Removed modalWarningDesktop

    // --- Picker Items ---
    pickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.background.subtle,
    },
    pickerItemSelected: {
        backgroundColor: theme.components.button.primary.bg + '15',
    },
    pickerItemText: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
    },
    pickerItemTextSelected: {
        color: theme.components.button.primary.bg,
        fontWeight: '600',
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.background.subtle,
    },
    playerItemName: {
        flex: 1,
        marginLeft: spacing.md,
        fontSize: typography.size.md,
        color: theme.text.primary,
    },
    playerItemSelected: {
        backgroundColor: theme.components.button.primary.bg + '15',
    },
    playerItemNameSelected: {
        color: theme.components.button.primary.bg,
        fontWeight: '600',
    },
});
