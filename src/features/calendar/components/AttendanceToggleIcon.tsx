import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors } from '@/src/design/tokens/colors';

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
    const isGroup = playerCount > 1;

    // Configuration based on status
    const getConfig = () => {
        switch (status) {
            case 'present':
                return {
                    backgroundColor: colors.success[500],
                    textColor: colors.common.white,
                    iconColor: colors.common.white,
                    label: isGroup ? 'Presentes' : 'Presente',
                    iconName: isGroup ? 'people' : 'person',
                };
            case 'absent':
                return {
                    backgroundColor: colors.error[500],
                    textColor: colors.common.white,
                    iconColor: colors.common.white,
                    label: isGroup ? 'Ausentes' : 'Ausente',
                    iconName: isGroup ? 'people' : 'person',
                };
            case 'mixed':
                return {
                    backgroundColor: colors.warning[500],
                    textColor: colors.common.white,
                    iconColor: colors.common.white,
                    label: 'Parcial',
                    iconName: isGroup ? 'people' : 'person',
                };
            default: // pending
                return {
                    backgroundColor: colors.neutral[200],
                    textColor: colors.neutral[600],
                    iconColor: colors.neutral[500],
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
        fontSize: 10,
        fontWeight: '600',
    },
});
