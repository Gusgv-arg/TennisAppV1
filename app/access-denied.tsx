import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function AccessDeniedScreen() {
    const { t } = useTranslation();
    const { signOut } = useAuthStore();
    const { theme } = useTheme();

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('accessDenied'), headerShown: false }} />
            <Card style={styles.card} padding="xl">
                <Text style={styles.icon}>🚫</Text>
                <Text style={styles.title}>{t('accessDenied')}</Text>
                <Text style={styles.message}>
                    {t('accessDeniedMessage')}
                </Text>
                <Button
                    label={t('logout')}
                    onPress={signOut}
                    variant="outline"
                    style={styles.button}
                    leftIcon={<Ionicons name="log-out-outline" size={20} color={theme.components.button.primary.bg} />}
                />
            </Card>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        maxWidth: 400,
        backgroundColor: theme.background.default,
        alignItems: 'center',
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.variants.h2,
        color: theme.text.primary,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    message: {
        ...typography.variants.bodyLarge,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        minWidth: 200,
    },
});
