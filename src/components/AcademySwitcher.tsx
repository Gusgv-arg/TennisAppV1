import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations, useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';
import { Academy } from '@/src/types/academy';

interface AcademySwitcherProps {
    compact?: boolean;
}

/**
 * Component to display current academy and allow switching between academies
 * Shows in header or settings when user belongs to multiple academies
 */
export function AcademySwitcher({ compact = false }: AcademySwitcherProps) {
    const { data: currentAcademy, isLoading: loadingCurrent } = useCurrentAcademy();
    const { data: academiesData, isLoading: loadingAcademies } = useUserAcademies();
    const { switchAcademy } = useAcademyMutations();
    const { theme, isDark } = useTheme();

    const [showModal, setShowModal] = useState(false);
    const [switching, setSwitching] = useState(false);

    // Combine active academies for switching (only active ones)
    const academies = academiesData?.active || [];

    const handleSwitch = async (academy: Academy) => {
        if (academy.id === currentAcademy?.id) {
            setShowModal(false);
            return;
        }

        setSwitching(true);
        try {
            await switchAcademy.mutateAsync(academy.id);
            setShowModal(false);
            // The page will refresh automatically due to query invalidation
        } catch (error) {
            console.error('Error switching academy:', error);
        } finally {
            setSwitching(false);
        }
    };

    if (loadingCurrent || loadingAcademies) {
        return <ActivityIndicator size="small" color={theme.components.button.primary.bg} />;
    }

    // Don't show if user only has one academy
    if (!academies || academies.length <= 1) {
        return null;
    }

    // Compact version for header
    if (compact) {
        return (
            <>
                <TouchableOpacity
                    onPress={() => setShowModal(true)}
                    style={styles.compactButton}
                >
                    <Ionicons name="school" size={20} color={theme.components.button.primary.bg} />
                    <Ionicons name="chevron-down" size={14} color={theme.text.tertiary} />
                </TouchableOpacity>

                <AcademyModal
                    visible={showModal}
                    academies={academies}
                    currentAcademyId={currentAcademy?.id}
                    onSelect={handleSwitch}
                    onClose={() => setShowModal(false)}
                    loading={switching}
                />
            </>
        );
    }

    // Full version for settings
    return (
        <>
            <TouchableOpacity onPress={() => setShowModal(true)}>
                <Card style={styles.fullCard} padding="md">
                    <View style={styles.cardContent}>
                        <View style={[styles.academyIcon, { backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="school" size={24} color={theme.components.button.primary.bg} />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={[styles.cardLabel, { color: theme.text.tertiary }]}>Academia actual</Text>
                            <Text style={[styles.academyName, { color: theme.text.primary }]}>{currentAcademy?.name}</Text>
                        </View>
                        <View style={[styles.switchBadge, { backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="swap-horizontal" size={16} color={theme.components.button.primary.bg} />
                            <Text style={[styles.switchText, { color: theme.components.button.primary.bg }]}>Cambiar</Text>
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>

            <AcademyModal
                visible={showModal}
                academies={academies}
                currentAcademyId={currentAcademy?.id}
                onSelect={handleSwitch}
                onClose={() => setShowModal(false)}
                loading={switching}
            />
        </>
    );
}

// Modal component for selecting academy
interface AcademyModalProps {
    visible: boolean;
    academies: Academy[];
    currentAcademyId?: string;
    onSelect: (academy: Academy) => void;
    onClose: () => void;
    loading: boolean;
}

function AcademyModal({ visible, academies, currentAcademyId, onSelect, onClose, loading }: AcademyModalProps) {
    const { theme, isDark } = useTheme();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.background.surface, shadowColor: '#000' }]}>
                    <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Seleccionar Academia</Text>

                    {academies.map((academy) => (
                        <TouchableOpacity
                            key={academy.id}
                            style={[
                                styles.academyOption,
                                { backgroundColor: theme.background.subtle },
                                academy.id === currentAcademyId && { backgroundColor: theme.background.surface, borderColor: theme.border.active, borderWidth: 1 }
                            ]}
                            onPress={() => onSelect(academy)}
                            disabled={loading}
                        >
                            <View style={styles.academyOptionIcon}>
                                <Ionicons
                                    name="school"
                                    size={24}
                                    color={academy.id === currentAcademyId ? theme.components.button.primary.bg : theme.text.disabled}
                                />
                            </View>
                            <Text style={[
                                styles.academyOptionText,
                                { color: theme.text.secondary },
                                academy.id === currentAcademyId && { color: theme.text.primary, fontWeight: '600' },
                            ]}>
                                {academy.name}
                            </Text>
                            {academy.id === currentAcademyId && (
                                <Ionicons name="checkmark-circle" size={24} color={theme.components.button.primary.bg} />
                            )}
                        </TouchableOpacity>
                    ))}

                    {loading && (
                        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                            <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Cambiando...</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={[styles.closeButtonText, { color: theme.text.tertiary }]}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
const styles = StyleSheet.create({
    academyIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    academyName: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    compactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: spacing.xs,
    },
    fullCard: {
        marginBottom: spacing.sm,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardText: {
        flex: 1,
        marginLeft: spacing.md,
    },
    cardLabel: {
        fontSize: typography.size.xs,
    },
    switchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    switchText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        borderRadius: 20,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    academyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.xs,
    },
    academyOptionActive: {
    },
    academyOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    academyOptionText: {
        flex: 1,
        fontSize: typography.size.md,
        fontWeight: '500',
    },
    academyOptionTextActive: {
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.sm,
    },
    closeButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
});
