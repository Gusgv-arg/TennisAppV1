import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useViewStore } from '@/src/store/useViewStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../design/theme';

export const AcademyHeaderTitle = () => {
    const { profile } = useAuthStore();
    const { data: academiesData } = useUserAcademies();

    const { switchAcademy } = useAcademyMutations();

    const { isGlobalView, setGlobalView } = useViewStore();

    // Safety check: ensure arrays exist
    const activeAcademies = academiesData?.active || [];
    const archivedAcademies = academiesData?.archived || [];
    const allAcademies = [...activeAcademies, ...archivedAcademies];

    const [modalVisible, setModalVisible] = useState(false);

    // Find current academy object for name display
    const currentAcademy = allAcademies.find(a => a.id === profile?.current_academy_id);
    const displayName = isGlobalView ? 'Vista Global' : (currentAcademy?.name || 'Seleccionar Academia');

    // Only show switcher if user has more than 1 academy or no academy selected
    // BUT user wants it "pro", usually pro apps show it always if there's a context concept, 
    // or at least if there's possibility to create new.
    // Let's show it always to allow "Create New" flow via this menu later if needed.
    // Or stick to logic: show if > 1. 
    // User wiped DB so likely has 0 or 1. If 1, maybe just show name without arrow?
    // Let's make it interactive always if > 1, static if 1? 
    // Slack shows it always. Let's make it interactive always for consistency.
    const canSwitch = allAcademies.length > 1;

    const handleSwitch = (academyId: string | null) => {
        setModalVisible(false);
        if (academyId === null) {
            setGlobalView(true);
        } else {
            setGlobalView(false);
            if (profile?.current_academy_id !== academyId) {
                switchAcademy.mutate(academyId);
            }
        }
    };

    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    // If user has only 1 academy, we don't show the switcher at all
    if (!canSwitch) {
        return null;
    }

    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => canSwitch && setModalVisible(true)}
                disabled={!canSwitch}
                style={[styles.headerButton, !canSwitch && styles.headerButtonDisabled]}
            >
                <Ionicons
                    name={isGlobalView ? "earth" : "business"}
                    size={14}
                    color={theme.border.active}
                    style={{ marginRight: 6 }}
                />
                <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {displayName}
                </Text>
                {canSwitch && (
                    <Ionicons
                        name="chevron-down"
                        size={12}
                        color={theme.text.tertiary}
                        style={{ marginLeft: 4, marginTop: 1 }}
                    />
                )}
            </TouchableOpacity>

            <Modal
                transparent
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <View style={[styles.dropdownContainer, { backgroundColor: theme.background.surface }]}>
                        <View style={[styles.dropdownHeader, { borderBottomColor: theme.border.subtle }]}>
                            <Text style={[styles.dropdownTitle, { color: theme.text.tertiary }]}>Cambiar de Academia</Text>
                        </View>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {/* Global View Option */}
                            <TouchableOpacity
                                style={[styles.academyOption, isGlobalView && { backgroundColor: theme.background.subtle }]}
                                onPress={() => handleSwitch(null)}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: theme.background.subtle }, isGlobalView && { backgroundColor: theme.components.badge.secondary }]}>
                                    <Ionicons
                                        name="earth"
                                        size={20}
                                        color={isGlobalView ? theme.status.info : theme.text.tertiary}
                                    />
                                </View>
                                <Text style={[styles.academyName, { color: theme.text.primary }, isGlobalView && { color: theme.status.info, fontWeight: '700' }]}>
                                    Vista Global
                                </Text>
                                {isGlobalView && (
                                    <Ionicons name="checkmark" size={18} color={theme.status.info} />
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 1, backgroundColor: theme.border.subtle, marginHorizontal: spacing.md }} />

                            {activeAcademies.map((academy) => {
                                const isActive = !isGlobalView && academy.id === profile?.current_academy_id;
                                return (
                                    <TouchableOpacity
                                        key={academy.id}
                                        style={[styles.academyOption, isActive && { backgroundColor: theme.background.subtle }]}
                                        onPress={() => handleSwitch(academy.id)}
                                    >
                                        <View style={[styles.iconContainer, { backgroundColor: theme.background.subtle }]}>
                                            <Ionicons
                                                name={isActive ? "business" : "business-outline"}
                                                size={20}
                                                color={isActive ? theme.border.active : theme.text.tertiary}
                                            />
                                        </View>
                                        <Text style={[styles.academyName, { color: theme.text.primary }, isActive && { color: theme.border.active, fontWeight: '600' }]}>
                                            {academy.name}
                                        </Text>
                                        {isActive && (
                                            <Ionicons name="checkmark" size={18} color={theme.border.active} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Footer for 'Create New' or 'Admin' could go here */}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    headerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: theme.background.subtle,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    headerButtonDisabled: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0,
    },
    headerTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        maxWidth: 180,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-start',
        paddingTop: 100,
        alignItems: 'center',
    },
    dropdownContainer: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 16,
        paddingVertical: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    dropdownHeader: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        marginBottom: spacing.xs,
    },
    dropdownTitle: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    academyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    academyOptionActive: {
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    academyName: {
        fontSize: typography.size.md,
        fontWeight: '500',
        flex: 1,
    },
    academyNameActive: {
    },
});
