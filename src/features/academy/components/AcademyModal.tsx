import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useAcademyMutations, useCurrentAcademyMember } from '@/src/features/academy/hooks/useAcademy';
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

interface AcademyModalProps {
    visible: boolean;
    onClose: () => void;
    academy: Academy | null; // null for create mode
}

export const AcademyModal = ({ visible, onClose, academy }: AcademyModalProps) => {
    const isEditing = !!academy;
    const { createAcademy, updateAcademy, archiveAcademy, transferOwnership } = useAcademyMutations();
    const { data: currentMember } = useCurrentAcademyMember();
    // Only fetch members if editing and we have an ID
    const { data: members } = useAcademyMembers(academy?.id || '');

    // Form State
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
    const [paymentsEnabled, setPaymentsEnabled] = useState(true);
    const [paymentsSimplified, setPaymentsSimplified] = useState(false);

    // Flow State
    const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'danger'>('info');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusConfig, setStatusConfig] = useState<{ type: StatusType, title: string, message: string } | null>(null);

    // Sub-modals
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [showTimezoneModal, setShowTimezoneModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [selectedNewOwner, setSelectedNewOwner] = useState<AcademyMember | null>(null);

    // Permissions
    const currentUserMember = members?.find(m => m.user_id === currentMember?.user_id);
    const isOwner = isEditing ? (currentUserMember?.role === 'owner' || currentMember?.role === 'owner') : true;

    const eligibleMembers = members?.filter(m =>
        m.user_id && m.user_id !== currentMember?.user_id && m.is_active
    ) || [];

    // Reset Form when opening
    useEffect(() => {
        if (visible) {
            if (academy) {
                // Edit Mode
                setName(academy.name);
                const settings = academy.settings as AcademySettings;
                setCurrency(settings?.currency || 'ARS');
                setTimezone(settings?.timezone || 'America/Argentina/Buenos_Aires');
                setPaymentsEnabled(settings?.payments_enabled ?? true);
                setPaymentsSimplified(settings?.payments_simplified ?? false);
                setActiveTab('info');
            } else {
                // Create Mode
                setName('');
                setCurrency('ARS');
                setTimezone('America/Argentina/Buenos_Aires');
                setPaymentsEnabled(true);
                setPaymentsSimplified(false);
                setActiveTab('info');
            }
        }
    }, [visible, academy]);

    const showStatus = (type: StatusType, title: string, message: string) => {
        setStatusConfig({ type, title, message });
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showStatus('error', 'Error', 'El nombre es requerido');
            return;
        }

        setIsSubmitting(true);
        try {
            if (isEditing && academy) {
                await updateAcademy.mutateAsync({
                    id: academy.id,
                    name: name.trim(),
                    settings: {
                        currency,
                        timezone,
                        payments_enabled: paymentsEnabled,
                        payments_simplified: paymentsSimplified,
                    },
                });
                showStatus('success', 'Éxito', 'Academia actualizada correctamente');
            } else {
                // Create
                const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
                await createAcademy.mutateAsync({
                    name: name.trim(),
                    slug,
                });
                showStatus('success', 'Éxito', 'Academia creada correctamente');
            }
        } catch (err: any) {
            console.error(err);
            showStatus('error', 'Error', err?.message || 'Ha ocurrido un error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTransfer = async () => {
        if (!selectedNewOwner?.user_id || !academy) return;
        setIsSubmitting(true);
        try {
            await transferOwnership.mutateAsync({
                academyId: academy.id,
                newOwnerId: selectedNewOwner.user_id,
            });
            setShowTransferModal(false);
            showStatus('success', 'Transferencia Exitosa', 'Has transferido la propiedad de la academia.');
        } catch (err: any) {
            showStatus('error', 'Error', err?.message || 'Error al transferir');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!academy) return;
        setIsSubmitting(true);
        setShowArchiveConfirm(false);
        try {
            await archiveAcademy.mutateAsync(academy.id);
            showStatus('success', 'Archivada', 'La academia ha sido archivada.');
        } catch (err: any) {
            showStatus('error', 'Error', err?.message || 'Error al archivar');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseStatus = () => {
        const wasSuccess = statusConfig?.type === 'success';
        setStatusConfig(null);
        if (wasSuccess) {
            onClose();
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, styles.desktopContainer]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {isEditing ? 'Editar Academia' : 'Nueva Academia'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.neutral[500]} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs (Only if Editing) */}
                    {isEditing && (
                        <View style={styles.tabs}>
                            <TabButton
                                label="General"
                                active={activeTab === 'info'}
                                onPress={() => setActiveTab('info')}
                            />
                            {isOwner && (
                                <TabButton
                                    label="Configuración"
                                    active={activeTab === 'settings'}
                                    onPress={() => setActiveTab('settings')}
                                />
                            )}
                            {isOwner && (
                                <TabButton
                                    label="Peligro"
                                    active={activeTab === 'danger'}
                                    onPress={() => setActiveTab('danger')}
                                    danger
                                />
                            )}
                        </View>
                    )}

                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {activeTab === 'info' && (
                            <View style={styles.section}>
                                <Input
                                    label="Nombre de la Academia"
                                    placeholder="Ej: Club de Tenis Los Pinos"
                                    value={name}
                                    onChangeText={setName}
                                    editable={isOwner || !isEditing}
                                />
                                {!isEditing && (
                                    <View style={styles.infoBox}>
                                        <Ionicons name="information-circle" size={20} color={colors.secondary[700]} />
                                        <Text style={styles.infoText}>
                                            Al crear una academia, serás el propietario. Podrás invitar colaboradores desde la sección Equipo.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {activeTab === 'settings' && isOwner && (
                            <View style={styles.section}>
                                <SettingsButton
                                    label="Moneda"
                                    value={CURRENCY_OPTIONS.find(c => c.value === currency)?.label}
                                    onPress={() => setShowCurrencyModal(true)}
                                />
                                <SettingsButton
                                    label="Zona Horaria"
                                    value={TIMEZONE_OPTIONS.find(t => t.value === timezone)?.label}
                                    onPress={() => setShowTimezoneModal(true)}
                                />
                                <SettingsToggle
                                    label="Pagos"
                                    value={paymentsEnabled ? 'Habilitados' : 'Deshabilitados'}
                                    isActive={paymentsEnabled}
                                    onPress={() => setPaymentsEnabled(!paymentsEnabled)}
                                />
                                {paymentsEnabled && (
                                    <SettingsToggle
                                        label="Modo Simplificado"
                                        value={paymentsSimplified ? 'Ocultar montos' : 'Mostrar montos'}
                                        isActive={!paymentsSimplified} // "On" means standard, "Off" means simplified? No, toggle is for "Simplified Mode".
                                        // Wait, user logic was: paymentsSimplified ? 'Ocultar montos' : 'Mostrar montos'.
                                        // Toggle icon: eye-off (if simplified) else eye.
                                        icon={paymentsSimplified ? 'eye-off' : 'eye'}
                                        onPress={() => setPaymentsSimplified(!paymentsSimplified)}
                                    />
                                )}
                            </View>
                        )}

                        {activeTab === 'danger' && isOwner && (
                            <View style={styles.section}>
                                <View style={styles.dangerBox}>
                                    <Text style={styles.dangerTitle}>Zona de Peligro</Text>

                                    <DangerButton
                                        label="Transferir Propiedad"
                                        description={eligibleMembers.length === 0 ? "No hay miembros elegibles" : "Ceder la propiedad a otro miembro"}
                                        icon="swap-horizontal"
                                        color={colors.warning[600]}
                                        onPress={() => setShowTransferModal(true)}
                                        disabled={eligibleMembers.length === 0}
                                    />

                                    <DangerButton
                                        label="Archivar Academia"
                                        description="Los datos se conservarán pero no será visible"
                                        icon="archive"
                                        color={colors.error[600]}
                                        onPress={() => setShowArchiveConfirm(true)}
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer Actions (Only for Info/Settings tabs) */}
                    {(activeTab !== 'danger') && (
                        <View style={styles.footer}>

                            {(isOwner || !isEditing) && (
                                <Button
                                    label={isEditing ? "Guardar" : "Crear Academia"}
                                    onPress={handleSave}
                                    loading={isSubmitting}
                                    style={styles.footerButton}
                                />
                            )}
                        </View>
                    )}
                </View>

                {/* Modals */}
                <StatusModal
                    visible={!!statusConfig}
                    type={statusConfig?.type || 'info'}
                    title={statusConfig?.title || ''}
                    message={statusConfig?.message || ''}
                    onClose={handleCloseStatus}
                />

                <OptionsModal
                    visible={showCurrencyModal}
                    title="Seleccionar Moneda"
                    options={CURRENCY_OPTIONS}
                    selectedValue={currency}
                    onSelect={(val: string) => { setCurrency(val); setShowCurrencyModal(false); }}
                    onClose={() => setShowCurrencyModal(false)}
                />

                <OptionsModal
                    visible={showTimezoneModal}
                    title="Seleccionar Zona Horaria"
                    options={TIMEZONE_OPTIONS}
                    selectedValue={timezone}
                    onSelect={(val: string) => { setTimezone(val); setShowTimezoneModal(false); }}
                    onClose={() => setShowTimezoneModal(false)}
                />

                <Modal
                    visible={showTransferModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowTransferModal(false)}
                >
                    <View style={styles.overlay}>
                        <View style={[styles.container, { maxWidth: 400, maxHeight: 600 }]}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Transferir Propiedad</Text>
                            </View>
                            <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
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
                                {eligibleMembers.length === 0 && (
                                    <Text style={{ textAlign: 'center', color: colors.neutral[500], padding: spacing.lg }}>
                                        No hay miembros elegibles.
                                    </Text>
                                )}
                            </ScrollView>
                            <View style={styles.footer}>
                                <Button label="Cancelar" variant="outline" onPress={() => setShowTransferModal(false)} style={{ width: 120 }} />
                                <Button label="Transferir" onPress={handleTransfer} disabled={!selectedNewOwner} style={{ width: 120 }} />
                            </View>
                        </View>
                    </View>
                </Modal>

                <StatusModal
                    visible={showArchiveConfirm}
                    type="warning"
                    title="Archivar Academia"
                    message={`¿Estás seguro de que deseas archivar "${academy?.name}"?`}
                    onClose={() => setShowArchiveConfirm(false)}
                    onConfirm={handleArchive}
                    buttonText="Archivar"
                    showCancel
                />

            </View>
        </Modal>
    );
};

// --- Helper Components ---

const TabButton = ({ label, active, onPress, danger }: any) => (
    <TouchableOpacity
        style={[styles.tab, active && styles.activeTab, danger && active && styles.activeDangerTab]}
        onPress={onPress}
    >
        <Text style={[styles.tabText, active && styles.activeTabText, danger && active && styles.dangerText]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const SettingsButton = ({ label, value, onPress }: any) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
        <View>
            <Text style={styles.settingLabel}>{label}</Text>
            <Text style={styles.settingValue}>{value}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
    </TouchableOpacity>
);

const SettingsToggle = ({ label, value, isActive, onPress, icon }: any) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
        <View>
            <Text style={styles.settingLabel}>{label}</Text>
            <Text style={styles.settingValue}>{value}</Text>
        </View>
        <Ionicons
            name={icon || (isActive ? 'checkmark-circle' : 'close-circle')}
            size={24}
            color={isActive ? colors.success[500] : colors.neutral[400]}
        />
    </TouchableOpacity>
);

const DangerButton = ({ label, description, icon, color, onPress, disabled }: any) => (
    <TouchableOpacity style={[styles.dangerItem, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
        <Ionicons name={icon} size={24} color={color} />
        <View style={{ flex: 1 }}>
            <Text style={[styles.dangerItemText, { color }]}>{label}</Text>
            <Text style={styles.dangerItemDesc}>{description}</Text>
        </View>
    </TouchableOpacity>
);

const OptionsModal = ({ visible, title, options, selectedValue, onSelect, onClose }: any) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
            <View style={[styles.container, { maxWidth: 400, maxHeight: 600 }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={colors.neutral[500]} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
                    {options.map((opt: any) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.optionItem, opt.value === selectedValue && styles.optionItemSelected]}
                            onPress={() => onSelect(opt.value)}
                        >
                            <Text style={[styles.optionText, opt.value === selectedValue && styles.optionTextSelected]}>
                                {opt.label}
                            </Text>
                            {opt.value === selectedValue && <Ionicons name="checkmark" size={20} color={colors.primary[500]} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        backgroundColor: colors.common.white,
        borderRadius: 20,
        width: '100%',
        maxHeight: '90%',
        display: 'flex',
        flexDirection: 'column',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    desktopContainer: {
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    tab: {
        paddingVertical: spacing.md,
        marginRight: spacing.lg,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary[500],
    },
    activeDangerTab: {
        borderBottomColor: colors.error[500],
    },
    tabText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    activeTabText: {
        color: colors.primary[500],
    },
    dangerText: {
        color: colors.error[500],
    },
    content: {
        padding: spacing.lg,
    },
    section: {
        gap: spacing.md,
    },
    infoBox: {
        flexDirection: 'row',
        gap: spacing.sm,
        backgroundColor: colors.secondary[50],
        padding: spacing.md,
        borderRadius: 8,
        marginTop: spacing.sm,
    },
    infoText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.secondary[700],
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
    },
    footerButton: {
        minWidth: 120,
    },
    // Settings Styles
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    settingLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginBottom: 2,
    },
    settingValue: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    // Danger Styles
    dangerBox: {
        borderWidth: 1,
        borderColor: colors.error[200],
        backgroundColor: colors.error[50],
        borderRadius: 8,
        padding: spacing.md,
    },
    dangerTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.error[700],
        marginBottom: spacing.md,
    },
    dangerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.error[200],
    },
    dangerItemText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    dangerItemDesc: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    // Options Modal
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
    // Member Option
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
});
