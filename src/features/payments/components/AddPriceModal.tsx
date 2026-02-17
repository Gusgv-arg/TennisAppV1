import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';

interface AddPriceModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (amount: number, validFrom: string, sync: boolean) => void;
    isLoading: boolean;
}

export const AddPriceModal = ({ visible, onClose, onSave, isLoading }: AddPriceModalProps) => {
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const [amount, setAmount] = useState('');
    const [validFrom, setValidFrom] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    const [step, setStep] = useState<'form' | 'confirm'>('form');
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        isRetroactive: false
    });

    // Reset step when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep('form');
            setAmount('');
            setValidFrom(new Date());
        }
    }, [visible]);

    const handlePreCheck = () => {
        if (!amount) return;

        const price = parseFloat(amount);

        // Date comparison checks
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(validFrom);
        checkDate.setHours(0, 0, 0, 0);

        const isRetroactive = checkDate < today;

        if (isRetroactive) {
            setConfirmConfig({
                title: 'Actualización Retroactiva',
                message: `Estás cambiando el precio con fecha ${validFrom.toLocaleDateString()}.\n\nEsto recalculará el valor de todas las clases pasadas desde esa fecha, generando deuda o saldo a favor.\n\n¿Confirmar y recalcular?`,
                isRetroactive: true
            });
        } else {
            setConfirmConfig({
                title: 'Confirmar Nuevo Precio',
                message: `El precio de $${price} se aplicará a partir del ${validFrom.toLocaleDateString()} a todas las suscripciones.\n\n¿Deseas guardar?`,
                isRetroactive: false
            });
        }
        setStep('confirm');
    };

    const handleConfirm = () => {
        const price = parseFloat(amount);
        const dateStr = validFrom.toISOString().split('T')[0];
        onSave(price, dateStr, true);
    };

    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
            setValidFrom(selectedDate);
        }
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }
    };

    if (!visible) return null;



    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.container, { shadowColor: '#000' }]}>
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>
                            {step === 'form' ? 'Actualizar Precio' : confirmConfig.title}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {step === 'form' ? (
                            <>
                                <View style={styles.inputsRow}>
                                    <View style={styles.inputWrapper}>
                                        <Input
                                            label="Nuevo Monto"
                                            placeholder="0"
                                            keyboardType="numeric"
                                            value={amount}
                                            onChangeText={setAmount}
                                            size="sm"
                                            containerStyle={{ marginBottom: 0 }}
                                        />
                                    </View>

                                    {/* Date Picker Section */}
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.label}>Vigente Desde</Text>

                                        {Platform.OS === 'web' ? (
                                            <View style={styles.webPickerWrapper}>
                                                {React.createElement('input', {
                                                    type: 'date',
                                                    style: {
                                                        width: '100%',
                                                        height: '100%',
                                                        border: 'none',
                                                        outline: 'none',
                                                        backgroundColor: theme.background.input,
                                                        fontSize: 14,
                                                        fontFamily: 'System',
                                                        color: theme.text.primary,
                                                        cursor: 'pointer',
                                                        borderRadius: 8,
                                                        colorScheme: isDark ? 'dark' : 'light',
                                                    },
                                                    value: validFrom.toISOString().split('T')[0],
                                                    onChange: (e: any) => {
                                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                                        const localDate = new Date(y, m - 1, d);
                                                        setValidFrom(localDate);
                                                    }
                                                })}
                                            </View>
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.dateButton, { borderColor: theme.border.subtle, backgroundColor: theme.background.input }]}
                                                    onPress={() => setShowPicker(!showPicker)}
                                                >
                                                    <Text style={[styles.dateButtonText, { color: theme.text.primary }]}>
                                                        {validFrom.toLocaleDateString()}
                                                    </Text>
                                                    <Ionicons name="calendar-outline" size={18} color={theme.text.secondary} />
                                                </TouchableOpacity>

                                                {showPicker && (
                                                    <RNDateTimePicker
                                                        value={validFrom}
                                                        mode="date"
                                                        display="spinner"
                                                        onChange={handleDateChange}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </View>
                                </View>

                                {/* Sync Checkbox Removed */}

                                <View style={styles.actions}>
                                    <Button
                                        label="Cancelar"
                                        variant="outline"
                                        onPress={onClose}
                                        style={{ width: 120, height: 32, minHeight: 32, paddingVertical: 0, maxHeight: 32 }}
                                        size="sm"
                                    />
                                    <Button
                                        label="Guardar"
                                        onPress={handlePreCheck}
                                        loading={isLoading}
                                        variant="primary"
                                        style={{ width: 120, height: 32, minHeight: 32, paddingVertical: 0, maxHeight: 32 }}
                                        size="sm"
                                    />
                                </View>
                            </>
                        ) : (
                            <View style={styles.confirmContainer}>
                                <Ionicons
                                    name={confirmConfig.isRetroactive ? "alert-circle" : "information-circle"}
                                    size={48}
                                    color={confirmConfig.isRetroactive ? theme.status.warning : theme.status.info}
                                    style={{ marginBottom: spacing.sm }}
                                />
                                <Text style={[styles.confirmMessage, { color: theme.text.secondary }]}>
                                    {confirmConfig.message}
                                </Text>
                                <View style={styles.actions}>
                                    <Button
                                        label="Volver"
                                        variant="outline"
                                        onPress={() => setStep('form')}
                                        style={{ width: 120, height: 32, minHeight: 32, paddingVertical: 0, maxHeight: 32 }}
                                        size="sm"
                                    />
                                    <Button
                                        label="Confirmar"
                                        onPress={handleConfirm}
                                        loading={isLoading}
                                        variant="primary"
                                        style={{ width: 120, height: 32, minHeight: 32, paddingVertical: 0, maxHeight: 32 }}
                                        size="sm"
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.md,
    },
    container: {
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        borderColor: theme.border.subtle,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    title: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: theme.text.primary,
    },
    content: {
        gap: spacing.md,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    inputWrapper: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    label: {
        ...typography.variants.label,
        marginBottom: 4,
        color: theme.text.secondary,
    },
    webPickerWrapper: {
        borderWidth: 2,
        borderColor: theme.border.default, // Match Input default border
        borderRadius: 8, // Match Input sm radius
        paddingHorizontal: spacing.sm,
        height: 40, // Match Input sm height
        justifyContent: 'center',
        backgroundColor: theme.background.input,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: theme.border.default,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        minHeight: 40,
        backgroundColor: theme.background.input,
    },
    dateButtonText: {
        fontSize: typography.size.sm,
        color: theme.text.primary,
    },
    confirmContainer: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    confirmMessage: {
        textAlign: 'center',
        fontSize: typography.size.md,
        lineHeight: 24,
        marginBottom: spacing.md,
    }
});
