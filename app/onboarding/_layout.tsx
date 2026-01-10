import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/src/design/tokens/colors';

export default function OnboardingLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.common.white,
                },
                headerTintColor: colors.neutral[900],
                headerShadowVisible: false,
                headerBackTitle: 'Atrás',
            }}
        >
            <Stack.Screen
                name="create-academy"
                options={{
                    title: 'Nueva Academia',
                    headerShown: true,
                }}
            />
        </Stack>
    );
}
