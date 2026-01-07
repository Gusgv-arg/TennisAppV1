import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/src/design/tokens/colors';

export default function CollaboratorsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false, // We handle headers in individual screens or hide them to use custom ones
                contentStyle: { backgroundColor: colors.neutral[50] },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="new" />
            <Stack.Screen name="edit" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
