import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';

export default function CollaboratorsLayout() {
    const router = useRouter();

    const BackButton = () => (
        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: spacing.sm }}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[700]} />
        </TouchableOpacity>
    );

    return (
        <Stack
            screenOptions={{
                contentStyle: { backgroundColor: colors.neutral[50] },
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
                name="new"
                options={{
                    headerShown: true,
                    headerLeft: () => <BackButton />,
                }}
            />
            <Stack.Screen
                name="edit"
                options={{
                    headerShown: true,
                    headerLeft: () => <BackButton />,
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    headerShown: true,
                    headerLeft: () => <BackButton />,
                }}
            />
        </Stack>
    );
}
