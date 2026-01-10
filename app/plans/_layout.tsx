import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/src/design/tokens/colors';

export default function PlansLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.neutral[50] },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="new" />
            <Stack.Screen name="edit" />
        </Stack>
    );
}
