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
    const [syncPrice, setSyncPrice] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    const handleSave = () => {
        if (!amount) return;
        onSave(parseFloat(amount), validFrom.toISOString().split('T')[0], syncPrice);
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

    // Minimum date is today (midnight)
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.container, { shadowColor: '#000' }]}>
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>Programar Nuevo Precio</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <Input
                            label="Nuevo Monto"
                            placeholder="0"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                        />

                        {/* Date Picker Section */}
                        <View style={styles.dateInputContainer}>
                            <Text style={styles.label}>Vigente Desde (YYYY-MM-DD)</Text>

                            {Platform.OS === 'web' ? (
                                <View style={styles.webPickerWrapper}>
                                    {React.createElement('input', {
                                        type: 'date',
                                        value: validFrom.toISOString().split('T')[0],
                                        min: minDate.toISOString().split('T')[0],
                                        onChange: (e: any) => {
                                            const newDate = new Date(e.target.value);
                                            // Fix timezone offset issue by treating the input as local date
                                            const userTimezoneOffset = newDate.getTimezoneOffset() * 60000;
                                            const adjustedDate = new Date(newDate.getTime() + userTimezoneOffset);

                                            // Actually, input type="date" value is YYYY-MM-DD. 
                                            // new Date("YYYY-MM-DD") parses as UTC. 
                                            // This often causes previous day if displayed in local time.
                                            // We want to store the YYYY-MM-DD string or a Date representing that start of day.
                                            // Let's simple parse components to avoid timezone drama.
                                            const [y, m, d] = e.target.value.split('-').map(Number);
                                            const localDate = new Date(y, m - 1, d);
                                            setValidFrom(localDate);
                                        },
                                        style: {
                                            width: '100%',
                                            height: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: 16,
                                            fontFamily: 'System',
                                            color: theme.text.primary,
                                            cursor: 'pointer'
                                        }
                                    })}
                                </View>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.dateButton, { borderColor: theme.border.subtle, backgroundColor: theme.background.surface }]}
                                        onPress={() => setShowPicker(!showPicker)}
                                    >
                                        <Text style={[styles.dateButtonText, { color: theme.text.primary }]}>
                                            {validFrom.toLocaleDateString()}
                                        </Text>
                                        <Ionicons name="calendar-outline" size={20} color={theme.text.secondary} />
                                    </TouchableOpacity>

                                    {showPicker && (
                                        <RNDateTimePicker
                                            value={validFrom}
                                            mode="date"
                                            display="spinner"
                                            onChange={handleDateChange}
                                            minimumDate={minDate}
                                        />
                                    )}
                                </>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.syncToggle}
                            onPress={() => setSyncPrice(!syncPrice)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, syncPrice && styles.checkboxActive]}>
                                {syncPrice && <Ionicons name="checkmark" size={14} color="white" />}
                            </View>
                            <Text style={[styles.syncText, { color: theme.text.secondary }]}>Actualizar suscripciones activas</Text>
                        </TouchableOpacity>

                        <View style={styles.actions}>
                            <Button
                                label="Cancelar"
                                variant="outline"
                                onPress={onClose}
                                style={{ flex: 1 }}
                            />
                            <Button
                                label="Guardar Precio"
                                onPress={handleSave}
                                loading={isLoading}
                                variant="primary"
                                style={{ flex: 1 }}
                            />
                        </View>
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
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    content: {
        gap: spacing.md,
    },
    syncToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.components.button.primary.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: theme.components.button.primary.bg,
    },
    syncText: {
        fontSize: typography.size.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    dateInputContainer: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    webPickerWrapper: {
        borderWidth: 2,
        borderRadius: 10,
        paddingHorizontal: spacing.sm,
        height: 48,
        justifyContent: 'center',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderRadius: 10,
        paddingHorizontal: spacing.sm,
        minHeight: 48,
    },
    dateButtonText: {
        fontSize: typography.size.md,
    },
});
