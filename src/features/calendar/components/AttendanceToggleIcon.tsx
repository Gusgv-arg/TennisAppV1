import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';

export type BulkAttendanceStatus = 'pending' | 'present' | 'absent' | 'mixed';

interface AttendanceToggleIconProps {
    /** Number of players in the session (1 = single person icon, 2+ = group icon) */
    playerCount: number;
    /** Current bulk attendance status */
    status: BulkAttendanceStatus;
    /** Callback when toggle is pressed */
    onPress: () => void;
    /** Whether the toggle is disabled */
    disabled?: boolean;
    /** Size (currently unused, for future use) */
    size?: number;
}

/**
 * A toggle button for bulk attendance that cycles through:
 * pending -> present -> absent -> pending
 * 
 * Shows an icon with a label badge indicating the current state.
 */
export function AttendanceToggleIcon({
    playerCount,
    status,
    onPress,
    disabled = false,
}: AttendanceToggleIconProps) {
    const { theme } = useTheme();
    const isGroup = playerCount > 1;

    // Configuration based on status
    const getConfig = () => {
        switch (status) {
            case 'present':
                return {
                    backgroundColor: theme.status.successBackground,
                    textColor: '#fff',
                    iconColor: '#fff',
                    label: isGroup ? 'Presentes' : 'Presente',
                    iconName: isGroup ? 'people' : 'person',
                };
            case 'absent':
                return {
                    backgroundColor: theme.status.errorBackground,
                    textColor: '#fff',
                    iconColor: '#fff',
                    label: isGroup ? 'Ausentes' : 'Ausente',
                    iconName: isGroup ? 'people' : 'person',
                };
            case 'mixed':
                return {
                    backgroundColor: theme.status.warningBackground,
                    textColor: '#fff',
                    iconColor: '#fff',
                    label: 'Parcial',
                    iconName: isGroup ? 'people' : 'person',
                };
            default: // pending
                return {
                    backgroundColor: theme.background.surface,
                    textColor: theme.text.secondary,
                    iconColor: theme.text.secondary,
                    label: 'Pendiente',
                    iconName: isGroup ? 'people-outline' : 'person-outline',
                };
        }
    };

    const config = getConfig();

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                styles.container,
                {
                    backgroundColor: config.backgroundColor,
                    borderColor: theme.border.subtle,
                    borderWidth: status === 'pending' ? 1 : 0,
                    opacity: disabled ? 0.5 : 1,
                },
            ]}
        >
            <Ionicons
                name={config.iconName as any}
                size={14}
                color={config.iconColor}
            />
            <Text style={[styles.label, { color: config.textColor }]}>
                {config.label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    label: {
        ...typography.variants.labelSmall,
        fontSize: 10,
    },
});
