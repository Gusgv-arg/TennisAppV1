import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations, useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
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
    const { data: academies, isLoading: loadingAcademies } = useUserAcademies();
    const { switchAcademy } = useAcademyMutations();

    const [showModal, setShowModal] = useState(false);
    const [switching, setSwitching] = useState(false);

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
        return <ActivityIndicator size="small" color={colors.primary[500]} />;
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
                    <Ionicons name="school" size={20} color={colors.primary[500]} />
                    <Ionicons name="chevron-down" size={14} color={colors.neutral[500]} />
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
                        <View style={styles.academyIcon}>
                            <Ionicons name="school" size={24} color={colors.primary[500]} />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardLabel}>Academia actual</Text>
                            <Text style={styles.academyName}>{currentAcademy?.name}</Text>
                        </View>
                        <View style={styles.switchBadge}>
                            <Ionicons name="swap-horizontal" size={16} color={colors.primary[500]} />
                            <Text style={styles.switchText}>Cambiar</Text>
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
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Seleccionar Academia</Text>

                    {academies.map((academy) => (
                        <TouchableOpacity
                            key={academy.id}
                            style={[
                                styles.academyOption,
                                academy.id === currentAcademyId && styles.academyOptionActive,
                            ]}
                            onPress={() => onSelect(academy)}
                            disabled={loading}
                        >
                            <View style={styles.academyOptionIcon}>
                                <Ionicons
                                    name="school"
                                    size={24}
                                    color={academy.id === currentAcademyId ? colors.primary[500] : colors.neutral[400]}
                                />
                            </View>
                            <Text style={[
                                styles.academyOptionText,
                                academy.id === currentAcademyId && styles.academyOptionTextActive,
                            ]}>
                                {academy.name}
                            </Text>
                            {academy.id === currentAcademyId && (
                                <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                            )}
                        </TouchableOpacity>
                    ))}

                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={colors.primary[500]} />
                            <Text style={styles.loadingText}>Cambiando...</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    singleAcademy: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    academyIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    academyName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
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
        color: colors.neutral[500],
    },
    switchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    switchText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.primary[600],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.common.white,
        borderRadius: 20,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    academyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.xs,
        backgroundColor: colors.neutral[50],
    },
    academyOptionActive: {
        backgroundColor: colors.primary[50],
        borderWidth: 1,
        borderColor: colors.primary[200],
    },
    academyOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.common.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    academyOptionText: {
        flex: 1,
        fontSize: typography.size.md,
        fontWeight: '500',
        color: colors.neutral[700],
    },
    academyOptionTextActive: {
        color: colors.primary[700],
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    closeButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[500],
    },
});
