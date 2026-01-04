import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function AccessDeniedScreen() {
    const { t } = useTranslation();
    const { signOut } = useAuthStore();

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
                />
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        maxWidth: 400,
        alignItems: 'center',
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    message: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    button: {
        minWidth: 200,
    },
});
