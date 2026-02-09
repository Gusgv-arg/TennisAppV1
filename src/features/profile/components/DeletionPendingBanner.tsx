import { Theme } from '@/src/design/theme';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAccountDeletion } from '../hooks/useAccountDeletion';

interface DeletionPendingBannerProps {
    onRehabilitationSuccess?: () => void;
    onRehabilitationError?: (message: string) => void;
}

export default function DeletionPendingBanner({
    onRehabilitationSuccess,
    onRehabilitationError
}: DeletionPendingBannerProps) {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const {
        isDeletionPending,
        daysRemaining,
        deletionScheduledAt,
        cancelDeletion
    } = useAccountDeletion();

    const handleCancelDeletion = async () => {
        try {
            const result = await cancelDeletion.mutateAsync();
            console.log('Cancel deletion result:', result);

            const isSuccess = result?.success || (result && !result.error);

            if (isSuccess) {
                onRehabilitationSuccess?.();
            } else {
                onRehabilitationError?.(result?.message || 'No se pudo completar la operación.');
            }
        } catch (error) {
            console.error('Cancel deletion error:', error);
            onRehabilitationError?.('No se pudo rehabilitar la cuenta. Intentá nuevamente.');
        }
    };

    if (!isDeletionPending) return null;

    const formattedDate = deletionScheduledAt
        ? deletionScheduledAt.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        : '';

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name="warning" size={24} color={theme.status.error} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>Cuenta marcada para eliminación</Text>
                <Text style={styles.message}>
                    Tu cuenta será eliminada el {formattedDate}.
                    {'\n'}
                    <Text style={styles.daysText}>
                        {daysRemaining} {daysRemaining === 1 ? 'día restante' : 'días restantes'}
                    </Text>
                </Text>
            </View>
            <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelDeletion}
                disabled={cancelDeletion.isPending}
            >
                {cancelDeletion.isPending ? (
                    <ActivityIndicator color="#34C759" size="small" />
                ) : (
                    <Text style={styles.cancelText}>Rehabilitar</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.status.errorBackground,
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.status.error,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.status.errorBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    title: {
        ...typography.variants.bodySmall,
        fontWeight: 'bold',
        color: theme.status.error,
        marginBottom: 2,
    },
    message: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        lineHeight: 18,
    },
    daysText: {
        fontWeight: 'bold',
        color: theme.status.error,
    },
    cancelButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.status.successBackground,
        borderWidth: 1,
        borderColor: theme.status.success,
    },
    cancelText: {
        ...typography.variants.bodySmall,
        fontWeight: 'bold',
        color: theme.status.success,
    },
});
