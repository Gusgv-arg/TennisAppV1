import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useViewStore } from '@/src/store/useViewStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
                    color={colors.primary[600]}
                    style={{ marginRight: 6 }}
                />
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {displayName}
                </Text>
                {canSwitch && (
                    <Ionicons
                        name="chevron-down"
                        size={12}
                        color={colors.primary[600]}
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
                    <View style={styles.dropdownContainer}>
                        <View style={styles.dropdownHeader}>
                            <Text style={styles.dropdownTitle}>Cambiar de Academia</Text>
                        </View>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {/* Global View Option */}
                            <TouchableOpacity
                                style={[styles.academyOption, isGlobalView && styles.academyOptionActive]}
                                onPress={() => handleSwitch(null)}
                            >
                                <View style={[styles.iconContainer, isGlobalView && { backgroundColor: colors.secondary[50] }]}>
                                    <Ionicons
                                        name="earth"
                                        size={20}
                                        color={isGlobalView ? colors.secondary[500] : colors.neutral[500]}
                                    />
                                </View>
                                <Text style={[styles.academyName, isGlobalView && { color: colors.secondary[600], fontWeight: '700' }]}>
                                    Vista Global
                                </Text>
                                {isGlobalView && (
                                    <Ionicons name="checkmark" size={18} color={colors.secondary[500]} />
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 1, backgroundColor: colors.neutral[100], marginHorizontal: spacing.md }} />

                            {activeAcademies.map((academy) => {
                                const isActive = !isGlobalView && academy.id === profile?.current_academy_id;
                                return (
                                    <TouchableOpacity
                                        key={academy.id}
                                        style={[styles.academyOption, isActive && styles.academyOptionActive]}
                                        onPress={() => handleSwitch(academy.id)}
                                    >
                                        <View style={styles.iconContainer}>
                                            <Ionicons
                                                name={isActive ? "business" : "business-outline"}
                                                size={20}
                                                color={isActive ? colors.primary[500] : colors.neutral[500]}
                                            />
                                        </View>
                                        <Text style={[styles.academyName, isActive && styles.academyNameActive]}>
                                            {academy.name}
                                        </Text>
                                        {isActive && (
                                            <Ionicons name="checkmark" size={18} color={colors.primary[500]} />
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

const styles = StyleSheet.create({
    headerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: colors.primary[50], // Pill background
        alignSelf: 'flex-start', // Don't stretch
        borderWidth: 1,
        borderColor: colors.primary[100],
    },
    headerButtonDisabled: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0, // Align left cleanly
    },
    headerTitle: {
        fontSize: typography.size.sm, // Smaller text
        fontWeight: '600',
        color: colors.primary[700],
        maxWidth: 180,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-start', // Align to top
        paddingTop: 100, // Offset for status bar + header
        alignItems: 'center',
    },
    dropdownContainer: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: colors.common.white,
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
        borderBottomColor: colors.neutral[100],
        marginBottom: spacing.xs,
    },
    dropdownTitle: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[500],
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
        backgroundColor: colors.primary[50],
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.neutral[100],
        alignItems: 'center',
        justifyContent: 'center',
    },
    academyName: {
        fontSize: typography.size.md,
        fontWeight: '500',
        color: colors.neutral[700],
        flex: 1,
    },
    academyNameActive: {
        color: colors.primary[700],
        fontWeight: '600',
    },
});
