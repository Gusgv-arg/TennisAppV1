import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingCarousel from '../../src/components/OnboardingCarousel';
import { Theme } from '../../src/design/theme';
import { spacing } from '../../src/design/tokens/spacing';
import { useTheme } from '../../src/hooks/useTheme';

export default function WelcomeScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const confettiRef = useRef<ConfettiCannon>(null);

    useEffect(() => {
        // Trigger confetti on mount
        confettiRef.current?.start();
    }, []);

    const handleFinish = () => {
        router.replace('/(tabs)/settings');
    };

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background.default} />
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="rocket" size={48} color={theme.components.button.primary.bg} />
                    <Text style={styles.welcomeText}>¡Ya tenés tu primer Academia!</Text>
                </View>
                <Text style={styles.subtitleText}>Te mostramos un pequeño recorrido antes de empezar</Text>
            </View>

            <OnboardingCarousel onFinish={handleFinish} />

            <ConfettiCannon
                ref={confettiRef}
                count={200}
                origin={{ x: -10, y: 0 }}
                autoStart={true}
                fadeOut={true}
            />
        </SafeAreaView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    header: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg, // Reduced top padding
        paddingBottom: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    welcomeText: {
        fontSize: 24, // Slightly smaller for single line
        fontWeight: 'bold',
        color: theme.text.primary,
        marginLeft: spacing.sm,
        textAlign: 'left',
    },
    subtitleText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});
