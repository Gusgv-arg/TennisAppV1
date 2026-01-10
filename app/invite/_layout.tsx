import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/src/design/tokens/colors';

export default function InviteLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.common.white,
                },
                headerTintColor: colors.neutral[900],
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="[token]"
                options={{
                    title: 'Invitación',
                    headerShown: true,
                }}
            />
        </Stack>
    );
}
