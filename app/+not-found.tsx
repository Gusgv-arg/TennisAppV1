import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';

const REDIRECT_SECONDS = 3;

export default function NotFoundScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const styles = React.useMemo(() => createStyles(theme), [theme]);

    const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-redirect countdown
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    router.replace('/(tabs)');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleGoHome = () => {
        router.replace('/(tabs)');
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <Card style={styles.card} padding="xl">
                    <View style={styles.iconContainer}>
                        <Ionicons name="alert-circle-outline" size={64} color={theme.text.disabled} />
                    </View>

                    <Text style={styles.title}>Página no encontrada</Text>
                    <Text style={styles.message}>
                        La página que buscás no existe o fue movida.
                    </Text>

                    <View style={styles.countdownContainer}>
                        <Text style={styles.countdownText}>
                            Redirigiendo en {countdown}s...
                        </Text>
                        {/* Progress bar */}
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${((REDIRECT_SECONDS - countdown) / REDIRECT_SECONDS) * 100}%` },
                                ]}
                            />
                        </View>
                    </View>

                    <Button
                        label="Ir al Inicio"
                        onPress={handleGoHome}
                        leftIcon={<Ionicons name="home-outline" size={18} color="#FFF" />}
                        style={styles.button}
                    />
                </Card>
            </Animated.View>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        maxWidth: 400,
        width: '100%',
        backgroundColor: theme.background.surface,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: spacing.md,
    },
    title: {
        ...typography.variants.h2,
        color: theme.text.primary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    message: {
        ...typography.variants.bodyLarge,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    countdownContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    countdownText: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        marginBottom: spacing.sm,
    },
    progressTrack: {
        width: '80%',
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.background.subtle,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: theme.components.button.primary.bg,
    },
    button: {
        minWidth: 180,
    },
});
