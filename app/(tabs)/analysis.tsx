import VideoList from '@/src/components/VideoList';
import { Button } from '@/src/design/components/Button';
import { spacing } from '@/src/design/tokens/spacing';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function VideoLibraryScreen() {
    const { theme, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background.default }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <View style={[styles.iconBadge, { backgroundColor: theme.status.info + '20' }]}>
                        <Ionicons name="library" size={20} color={theme.status.info} />
                    </View>
                    <View>
                        <Text style={[styles.title, { color: theme.text.primary }]}>{t('videoHub.library')}</Text>
                        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Videos de ejemplo o sin asignar a alumno</Text>
                    </View>
                </View>
                <Button
                    label="Grabar"
                    onPress={() => router.push('/record-video')}
                    variant="primary"
                    size="sm"
                    leftIcon={<Ionicons name="videocam" size={16} color="white" />}
                    shadow
                />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

            <View style={styles.content}>
                <VideoList playerId={null} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        marginTop: 1,
        opacity: 0.8,
    },
    divider: {
        height: 1,
        marginHorizontal: spacing.xl,
        marginBottom: spacing.sm,
    },
    content: {
        flex: 1,
    },
});
