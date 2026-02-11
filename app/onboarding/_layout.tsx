import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/src/hooks/useTheme';

export default function OnboardingLayout() {
    const { theme } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: theme.background.default,
                },
                headerTintColor: theme.text.primary,
                headerShadowVisible: false,
                headerBackTitle: 'Atrás',
            }}
        />
    );
}
