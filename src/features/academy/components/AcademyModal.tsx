import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useAcademyMutations, useCurrentAcademyMember } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';
import { Academy, AcademyMember, AcademySettings } from '@/src/types/academy';
import { showError, showSuccess } from '@/src/utils/toast';

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
    onCreateSuccess?: () => void;
}

export const AcademyModal = ({ visible, onClose, academy, onCreateSuccess }: AcademyModalProps) => {
    const isEditing = !!academy;
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
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


    // Sub-modals
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [showTimezoneModal, setShowTimezoneModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showDisablePaymentsConfirm, setShowDisablePaymentsConfirm] = useState(false);
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



    const handleTogglePayments = () => {
        if (paymentsEnabled) {
            setShowDisablePaymentsConfirm(true);
        } else {
            setPaymentsEnabled(true);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showError('Error', 'El nombre es requerido');
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
                showSuccess('Éxito', 'Academia actualizada correctamente');
                onClose();
            } else {
                // Create
                const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
                await createAcademy.mutateAsync({
                    name: name.trim(),
                    slug,
                });
                showSuccess('Éxito', 'Academia creada correctamente');
                if (onCreateSuccess) onCreateSuccess();
                else onClose();
            }
        } catch (err: any) {
            console.error(err);
            showError('Error', err?.message || 'Ha ocurrido un error');
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
            showSuccess('Transferencia Exitosa', 'Has transferido la propiedad de la academia.');
        } catch (err: any) {
            showError('Error', err?.message || 'Error al transferir');
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
            showSuccess('Archivada', 'La academia ha sido archivada.');
        } catch (err: any) {
            showError('Error', err?.message || 'Error al archivar');
        } finally {
            setIsSubmitting(false);
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
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.modalContent, styles.desktopContainer, {
                    backgroundColor: theme.background.surface,
                    shadowColor: '#000',
                    borderWidth: 1,
                    borderColor: theme.border.subtle,
                }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>
                            {isEditing ? 'Editar Academia' : 'Nueva Academia'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs (Only if Editing) */}
                    {isEditing && (
                        <View style={[styles.tabs, { borderBottomColor: theme.border.subtle }]}>
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
                                    <View style={[styles.infoBox, { backgroundColor: theme.status.infoBackground }]}>
                                        <Ionicons name="information-circle" size={20} color={theme.status.infoText} />
                                        <Text style={[styles.infoText, { color: theme.status.infoText }]}>
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
                                    onPress={handleTogglePayments}
                                />
                                {paymentsEnabled && (
                                    <SettingsToggle
                                        label="Modo Privacidad"
                                        value={paymentsSimplified ? 'Montos Ocultos' : 'Montos Visibles'}
                                        isActive={paymentsSimplified}
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
                                <View style={[styles.dangerBox, { backgroundColor: theme.status.errorBackground, borderColor: theme.status.error }]}>
                                    <Text style={[styles.dangerTitle, { color: theme.status.error }]}>Zona de Peligro</Text>

                                    <DangerButton
                                        label="Transferir Propiedad"
                                        description={eligibleMembers.length === 0 ? "No hay miembros elegibles" : "Ceder la propiedad a otro miembro"}
                                        icon="swap-horizontal"
                                        color={theme.status.warning}
                                        onPress={() => setShowTransferModal(true)}
                                        disabled={eligibleMembers.length === 0}
                                    />

                                    <DangerButton
                                        label="Archivar Academia"
                                        description="Los datos se conservarán pero no será visible"
                                        icon="archive"
                                        color={theme.status.error}
                                        onPress={() => setShowArchiveConfirm(true)}
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer Actions (Only for Info/Settings tabs) */}
                    {(activeTab !== 'danger') && (
                        <View style={[styles.footer, { borderTopColor: theme.border.subtle }]}>

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
                    <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                        <View style={[styles.modalContent, { maxWidth: 400, maxHeight: 600, backgroundColor: theme.background.surface, shadowColor: '#000' }]}>
                            <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                                <Text style={[styles.title, { color: theme.text.primary }]}>Transferir Propiedad</Text>
                            </View>
                            <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
                                {eligibleMembers.map((member) => (
                                    <TouchableOpacity
                                        key={member.id}
                                        style={[
                                            styles.memberOption,
                                            { backgroundColor: theme.background.subtle },
                                            selectedNewOwner?.id === member.id && { backgroundColor: theme.components.button.secondary.bg, borderColor: theme.components.button.primary.bg, borderWidth: 1 },
                                        ]}
                                        onPress={() => setSelectedNewOwner(member)}
                                    >
                                        <Text style={[styles.memberName, { color: theme.text.primary }]}>
                                            {member.user?.full_name || member.member_name || member.user?.email}
                                        </Text>
                                        <Text style={[styles.memberRole, { color: theme.text.secondary }]}>{member.role}</Text>
                                        {selectedNewOwner?.id === member.id && (
                                            <Ionicons name="checkmark-circle" size={20} color={theme.components.button.primary.bg} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                                {eligibleMembers.length === 0 && (
                                    <Text style={{ textAlign: 'center', color: theme.text.secondary, padding: spacing.lg }}>
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

                <StatusModal
                    visible={showDisablePaymentsConfirm}
                    type="warning"
                    title="Deshabilitar Pagos"
                    message="Al deshabilitar los pagos, la app funcionará solo para reservas y agenda. No se generarán deudas ni se registrarán cobros. ¿Deseas continuar?"
                    onClose={() => setShowDisablePaymentsConfirm(false)}
                    onConfirm={() => {
                        setPaymentsEnabled(false);
                        setShowDisablePaymentsConfirm(false);
                    }}
                    buttonText="Deshabilitar"
                    showCancel
                />

            </View>
        </Modal>
    );
};

// --- Helper Components ---

const TabButton = ({ label, active, onPress, danger }: any) => {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <TouchableOpacity
            style={[styles.tab, active && { borderBottomColor: theme.components.button.primary.bg }, danger && active && { borderBottomColor: theme.status.error }]}
            onPress={onPress}
        >
            <Text style={[styles.tabText, { color: theme.text.secondary }, active && { color: theme.components.button.primary.bg }, danger && active && { color: theme.status.error }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

const SettingsButton = ({ label, value, onPress }: any) => {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border.subtle }]} onPress={onPress}>
            <View>
                <Text style={[styles.settingLabel, { color: theme.text.secondary }]}>{label}</Text>
                <Text style={[styles.settingValue, { color: theme.text.primary }]}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
        </TouchableOpacity>
    );
};

const SettingsToggle = ({ label, value, isActive, onPress, icon }: any) => {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border.subtle }]} onPress={onPress}>
            <View>
                <Text style={[styles.settingLabel, { color: theme.text.secondary }]}>{label}</Text>
                <Text style={[styles.settingValue, { color: theme.text.primary }]}>{value}</Text>
            </View>
            <Ionicons
                name={icon || (isActive ? 'checkmark-circle' : 'close-circle')}
                size={24}
                color={isActive ? theme.status.success : theme.text.tertiary}
            />
        </TouchableOpacity>
    );
};

const DangerButton = ({ label, description, icon, color, onPress, disabled }: any) => {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <TouchableOpacity style={[styles.dangerItem, { borderBottomColor: theme.border.subtle }, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
            <Ionicons name={icon} size={24} color={color} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.dangerItemText, { color }]}>{label}</Text>
                <Text style={[styles.dangerItemDesc, { color: theme.text.secondary }]}>{description}</Text>
            </View>
        </TouchableOpacity>
    );
};

const OptionsModal = ({ visible, title, options, selectedValue, onSelect, onClose }: any) => {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.modalContent, { maxWidth: 400, maxHeight: 600, backgroundColor: theme.background.surface, shadowColor: '#000' }]}>
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.tertiary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
                        {options.map((opt: any) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.optionItem, { backgroundColor: theme.background.surface }, opt.value === selectedValue && { backgroundColor: theme.components.button.secondary.bg }]}
                                onPress={() => onSelect(opt.value)}
                            >
                                <Text style={[styles.optionText, { color: theme.text.secondary }, opt.value === selectedValue && { color: theme.components.button.primary.bg, fontWeight: '600' }]}>
                                    {opt.label}
                                </Text>
                                {opt.value === selectedValue && <Ionicons name="checkmark" size={20} color={theme.components.button.primary.bg} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    desktopContainer: {
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    title: {
        ...typography.variants.h2,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
    },
    tab: {
        paddingVertical: spacing.md,
        marginRight: spacing.lg,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
    },
    activeDangerTab: {
    },
    tabText: {
        ...typography.variants.label,
    },
    activeTabText: {
    },
    dangerText: {
        // Handled in line styles
    },
    content: {
        padding: spacing.md,
    },
    section: {
        gap: spacing.md,
    },
    infoBox: {
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: 8,
        marginTop: spacing.sm,
    },
    infoText: {
        flex: 1,
        ...typography.variants.bodyMedium,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
    },
    footerButton: {
        minWidth: 120,
    },
    // Settings Styles
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    settingLabel: {
        ...typography.variants.labelSmall,
        marginBottom: 2,
    },
    settingValue: {
        ...typography.variants.bodyLarge,
    },
    // Danger Styles
    dangerBox: {
        borderWidth: 1,
        borderRadius: 8,
        padding: spacing.sm,
    },
    dangerTitle: {
        ...typography.variants.bodyLarge,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    dangerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    dangerItemText: {
        ...typography.variants.label,
    },
    dangerItemDesc: {
        ...typography.variants.bodySmall,
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
    },
    optionText: {
        ...typography.variants.bodyLarge,
    },
    optionTextSelected: {
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
    },
    memberOptionSelected: {
        borderWidth: 1,
    },
    memberName: {
        flex: 1,
        ...typography.variants.bodyLarge,
    },
    memberRole: {
        ...typography.variants.bodySmall,
        marginRight: spacing.sm,
        textTransform: 'capitalize',
    },
});
