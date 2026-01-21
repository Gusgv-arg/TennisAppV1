import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useAcademyMutations, useCurrentAcademyMember } from '@/src/features/academy/hooks/useAcademy';
import { supabase } from '@/src/services/supabaseClient';
import { Academy, AcademyMember, AcademySettings } from '@/src/types/academy';

const CURRENCY_OPTIONS = [
    { value: 'ARS', label: 'Peso Argentino (ARS)' },
    { value: 'USD', label: 'Dólar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
    { value: 'BRL', label: 'Real Brasileño (BRL)' },
];

const TIMEZONE_OPTIONS = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
    { value: 'America/Santiago', label: 'Chile (Santiago)' },
    { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
    { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
    { value: 'America/New_York', label: 'Estados Unidos (New York)' },
    { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

export default function EditAcademyScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { updateAcademy, archiveAcademy, transferOwnership } = useAcademyMutations();
    const { data: currentMember } = useCurrentAcademyMember();
    const { data: members } = useAcademyMembers(id);

    const [academy, setAcademy] = useState<Academy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
    const [paymentsEnabled, setPaymentsEnabled] = useState(true);
    const [paymentsSimplified, setPaymentsSimplified] = useState(false);

    // Modal states
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [showTimezoneModal, setShowTimezoneModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [selectedNewOwner, setSelectedNewOwner] = useState<AcademyMember | null>(null);

    // Check if current user is owner of THIS academy (not the current selected one)
    const currentUserMember = members?.find(m => m.user_id === currentMember?.user_id);
    const isOwner = currentUserMember?.role === 'owner' || currentMember?.role === 'owner';

    // Eligible members for transfer (active members excluding current user)
    const eligibleMembers = members?.filter(m =>
        m.user_id && m.user_id !== currentMember?.user_id && m.is_active
    ) || [];

    useEffect(() => {
        const loadAcademy = async () => {
            if (!id) return;

            const { data, error } = await supabase
                .from('academies')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error loading academy:', error);
                setError('Error cargando academia');
            } else if (data) {
                setAcademy(data);
                setName(data.name);
                const settings = data.settings as AcademySettings;
                setCurrency(settings?.currency || 'ARS');
                setTimezone(settings?.timezone || 'America/Argentina/Buenos_Aires');
                setPaymentsEnabled(settings?.payments_enabled ?? true);
                setPaymentsSimplified(settings?.payments_simplified ?? false);
            }
            setIsLoading(false);
        };

        loadAcademy();
    }, [id]);

    const handleSave = async () => {
        if (!name.trim() || !id) {
            setError('El nombre es requerido');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await updateAcademy.mutateAsync({
                id,
                name: name.trim(),
                settings: {
                    currency,
                    timezone,
                    payments_enabled: paymentsEnabled,
                    payments_simplified: paymentsSimplified,
                },
            });
            router.back();
        } catch (err: any) {
            console.error('Error updating academy:', err);
            setError(err?.message || 'Error al actualizar');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTransferOwnership = async () => {
        if (!selectedNewOwner?.user_id || !id) return;

        setIsSubmitting(true);
        try {
            await transferOwnership.mutateAsync({
                academyId: id,
                newOwnerId: selectedNewOwner.user_id,
            });
            setShowTransferModal(false);
            router.replace('/academy' as any);
        } catch (err: any) {
            console.error('Error transferring ownership:', err);
            setError(err?.message || 'Error al transferir propiedad');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!id) return;

        setIsSubmitting(true);
        setShowArchiveConfirm(false);
        try {
            await archiveAcademy.mutateAsync(id);
            router.replace('/academy' as any);
        } catch (err: any) {
            console.error('Error archiving academy:', err);
            setError(err?.message || 'Error al archivar');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="create" size={24} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Editar Academia</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Basic Info */}
                <Card style={styles.card} padding="lg">
                    <Text style={styles.sectionTitle}>Información General</Text>

                    <Input
                        label="Nombre de la Academia"
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            setError(null);
                        }}
                        editable={isOwner}
                    />
                </Card>

                {/* Settings */}
                {isOwner && (
                    <Card style={styles.card} padding="lg">
                        <Text style={styles.sectionTitle}>Configuración</Text>

                        {/* Currency Selector */}
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setShowCurrencyModal(true)}
                        >
                            <View>
                                <Text style={styles.selectLabel}>Moneda</Text>
                                <Text style={styles.selectValue}>
                                    {CURRENCY_OPTIONS.find(c => c.value === currency)?.label}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                        </TouchableOpacity>

                        {/* Timezone Selector */}
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setShowTimezoneModal(true)}
                        >
                            <View>
                                <Text style={styles.selectLabel}>Zona Horaria</Text>
                                <Text style={styles.selectValue}>
                                    {TIMEZONE_OPTIONS.find(t => t.value === timezone)?.label}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                        </TouchableOpacity>

                        {/* Payments Toggle */}
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setPaymentsEnabled(!paymentsEnabled)}
                        >
                            <View>
                                <Text style={styles.selectLabel}>Pagos</Text>
                                <Text style={styles.selectValue}>
                                    {paymentsEnabled ? 'Habilitados' : 'Deshabilitados'}
                                </Text>
                            </View>
                            <Ionicons
                                name={paymentsEnabled ? 'checkmark-circle' : 'close-circle'}
                                size={24}
                                color={paymentsEnabled ? colors.success[500] : colors.neutral[400]}
                            />
                        </TouchableOpacity>

                        {/* Simplified Mode Toggle - Only shown if payments enabled */}
                        {paymentsEnabled && (
                            <TouchableOpacity
                                style={[styles.selectButton, { borderBottomWidth: 0 }]}
                                onPress={() => setPaymentsSimplified(!paymentsSimplified)}
                            >
                                <View>
                                    <Text style={styles.selectLabel}>Modo Simplificado</Text>
                                    <Text style={styles.selectValue}>
                                        {paymentsSimplified ? 'Ocultar montos' : 'Mostrar montos'}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={paymentsSimplified ? 'eye-off' : 'eye'}
                                    size={24}
                                    color={paymentsSimplified ? colors.primary[500] : colors.neutral[400]}
                                />
                            </TouchableOpacity>
                        )}
                    </Card>
                )}

                {/* Danger Zone */}
                {isOwner && (
                    <Card style={{ ...styles.card, ...styles.dangerCard }} padding="lg">
                        <Text style={[styles.sectionTitle, styles.dangerTitle]}>Zona de Peligro</Text>

                        {/* Transfer Ownership */}
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={() => setShowTransferModal(true)}
                            disabled={eligibleMembers.length === 0}
                        >
                            <View style={styles.dangerButtonContent}>
                                <Ionicons name="swap-horizontal" size={20} color={colors.warning[600]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dangerButtonText}>Transferir Propiedad</Text>
                                    <Text style={styles.dangerButtonHint}>
                                        {eligibleMembers.length === 0
                                            ? 'No hay otros miembros para transferir'
                                            : 'Ceder la propiedad a otro miembro'
                                        }
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Archive Academy */}
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={() => setShowArchiveConfirm(true)}
                        >
                            <View style={styles.dangerButtonContent}>
                                <Ionicons name="archive" size={20} color={colors.error[600]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.dangerButtonText, { color: colors.error[600] }]}>Archivar Academia</Text>
                                    <Text style={styles.dangerButtonHint}>
                                        Los datos se conservarán pero no será visible
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Card>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color={colors.error[500]} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Save Button */}
                {isOwner && (
                    <View style={styles.buttonContainer}>
                        <Button
                            label={isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                            onPress={handleSave}
                            disabled={isSubmitting || !name.trim()}
                            leftIcon={isSubmitting ? <ActivityIndicator size="small" color={colors.common.white} /> : <Ionicons name="checkmark" size={20} color={colors.common.white} />}
                            shadow
                        />
                    </View>
                )}
            </ScrollView>

            {/* Currency Modal */}
            <OptionsModal
                visible={showCurrencyModal}
                title="Seleccionar Moneda"
                options={CURRENCY_OPTIONS}
                selectedValue={currency}
                onSelect={(value) => {
                    setCurrency(value);
                    setShowCurrencyModal(false);
                }}
                onClose={() => setShowCurrencyModal(false)}
            />

            {/* Timezone Modal */}
            <OptionsModal
                visible={showTimezoneModal}
                title="Seleccionar Zona Horaria"
                options={TIMEZONE_OPTIONS}
                selectedValue={timezone}
                onSelect={(value) => {
                    setTimezone(value);
                    setShowTimezoneModal(false);
                }}
                onClose={() => setShowTimezoneModal(false)}
            />

            {/* Transfer Modal */}
            <Modal
                visible={showTransferModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTransferModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Transferir Propiedad</Text>
                        <Text style={styles.modalSubtitle}>
                            Selecciona el nuevo propietario. Tu rol cambiará a "Coach".
                        </Text>

                        {eligibleMembers.map((member) => (
                            <TouchableOpacity
                                key={member.id}
                                style={[
                                    styles.memberOption,
                                    selectedNewOwner?.id === member.id && styles.memberOptionSelected,
                                ]}
                                onPress={() => setSelectedNewOwner(member)}
                            >
                                <Text style={styles.memberName}>
                                    {member.user?.full_name || member.member_name || member.user?.email}
                                </Text>
                                <Text style={styles.memberRole}>{member.role}</Text>
                                {selectedNewOwner?.id === member.id && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        ))}

                        <View style={styles.modalActions}>
                            <Button
                                label="Cancelar"
                                variant="outline"
                                onPress={() => {
                                    setShowTransferModal(false);
                                    setSelectedNewOwner(null);
                                }}
                                style={{ flex: 1 }}
                            />
                            <Button
                                label="Transferir"
                                onPress={handleTransferOwnership}
                                disabled={!selectedNewOwner || isSubmitting}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Archive Confirmation */}
            <StatusModal
                visible={showArchiveConfirm}
                type="warning"
                title="Archivar Academia"
                message={`¿Estás seguro de que deseas archivar "${academy?.name}"? Los datos se conservarán pero la academia dejará de ser visible.`}
                onClose={() => setShowArchiveConfirm(false)}
                onConfirm={handleArchive}
                buttonText="Archivar"
                showCancel
            />
        </KeyboardAvoidingView>
    );
}

// Generic options modal component
interface OptionsModalProps {
    visible: boolean;
    title: string;
    options: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}

function OptionsModal({ visible, title, options, selectedValue, onSelect, onClose }: OptionsModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{title}</Text>

                    {options.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.optionItem,
                                option.value === selectedValue && styles.optionItemSelected,
                            ]}
                            onPress={() => onSelect(option.value)}
                        >
                            <Text style={[
                                styles.optionText,
                                option.value === selectedValue && styles.optionTextSelected,
                            ]}>
                                {option.label}
                            </Text>
                            {option.value === selectedValue && (
                                <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                            )}
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    card: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: spacing.md,
    },
    slugInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.neutral[100],
        borderRadius: 8,
    },
    slugLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    slugValue: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[600],
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    selectLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginBottom: 2,
    },
    selectValue: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    dangerCard: {
        borderWidth: 1,
        borderColor: colors.error[200],
        backgroundColor: colors.error[50],
    },
    dangerTitle: {
        color: colors.error[700],
    },
    dangerButton: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.error[100],
    },
    dangerButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    dangerButtonText: {
        fontSize: typography.size.md,
        fontWeight: '500',
        color: colors.warning[700],
    },
    dangerButtonHint: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        padding: spacing.sm,
        backgroundColor: colors.error[50],
        borderRadius: 8,
    },
    errorText: {
        fontSize: typography.size.sm,
        color: colors.error[600],
    },
    buttonContainer: {
        marginTop: spacing.md,
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
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    modalSubtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.xs,
    },
    optionItemSelected: {
        backgroundColor: colors.primary[50],
    },
    optionText: {
        fontSize: typography.size.md,
        color: colors.neutral[700],
    },
    optionTextSelected: {
        color: colors.primary[700],
        fontWeight: '600',
    },
    memberOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.xs,
        backgroundColor: colors.neutral[50],
    },
    memberOptionSelected: {
        backgroundColor: colors.primary[50],
        borderWidth: 1,
        borderColor: colors.primary[200],
    },
    memberName: {
        flex: 1,
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    memberRole: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginRight: spacing.sm,
        textTransform: 'capitalize',
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.lg,
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
