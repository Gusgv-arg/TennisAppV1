import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import DeleteAccountModal from '@/src/features/profile/components/DeleteAccountModal';
import DeletionPendingBanner from '@/src/features/profile/components/DeletionPendingBanner';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { useSubscription } from '@/src/features/subscription/hooks/useSubscription';
import { getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { useTheme } from '@/src/hooks/useTheme';
import { showError, showSuccess } from '@/src/utils/toast';
import { Modal } from 'react-native';
import { supabase } from '../../src/services/supabaseClient';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { profile: authProfile } = useAuthStore();
    const { data: profile } = useProfile();
    const { role: academyRole } = usePermissions();
    const { tierLabel, isBeta, isActive } = useSubscription();
    const { theme, isDark, themeMode, setThemeMode } = useTheme();
    const styles = createStyles(theme);
    const insets = useSafeAreaInsets();

    const [themeModalVisible, setThemeModalVisible] = useState(false);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    const handleLogout = async () => {
        try {
            // 1. Sign out from Supabase
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            // 2. Explicitly clear our store and persistence (including invite tokens)
            useAuthStore.getState().signOut();
            
            // 3. Force navigation to login (sometimes layout listener might delay)
            router.replace('/login');
        } catch (error: any) {
            showError('Error', error.message || 'No se pudo cerrar sesión');
        }
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'es' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleResetPassword = async () => {
        if (!authProfile?.email) return;

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(authProfile.email, {
                redirectTo: Linking.createURL('reset-password'),
            });

            if (error) throw error;

            showSuccess(t('resetPassword'), t('passwordResetEmailSent'));
        } catch (error: any) {
            showError(t('saveError'), error.message || t('errorOccurred'));
        }
    };

    const [countryName, setCountryName] = useState<string | null>(null);
    const [stateName, setStateName] = useState<string | null>(null);

    useEffect(() => {
        if (!profile) return;

        // Initial fallbacks
        setCountryName(profile.country || null);
        setStateName(profile.state_province || null);

        if (!profile.country) return;

        // Run asynchronously to prevent mobile Safari stack overflows 
        // caused by evaluating the huge JSON synchronously on render.
        const loadLocationData = async () => {
            try {
                const { Country, State } = await import('country-state-city');

                if (profile.country) {
                    const resolvedCountry = Country.getCountryByCode(profile.country);
                    if (resolvedCountry) setCountryName(resolvedCountry.name);
                }

                if (profile.state_province && profile.country) {
                    const resolvedState = State.getStateByCodeAndCountry(profile.state_province, profile.country);
                    if (resolvedState) setStateName(resolvedState.name);
                }
            } catch (error) {
                console.warn('Failed to resolve geographic names:', error);
            }
        };

        // Don't await on main thread
        setTimeout(() => loadLocationData(), 0);
    }, [profile?.country, profile?.state_province]);

    // Construct location string
    const getLocationString = () => {
        const parts = [];

        if (profile?.city) {
            parts.push(profile.city);
        }
        if (stateName && stateName !== profile?.city) {
            parts.push(stateName);
        }
        if (countryName) {
            parts.push(countryName);
        }

        return parts.length > 0 ? parts.join(', ') : null;
    };

    const locationString = getLocationString();



    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header with Profile Block */}
            <View style={[styles.headerContainer, {
                paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
                paddingBottom: 8,
            }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButtonAbsolute, { top: insets.top + (Platform.OS === 'android' ? 12 : 8) }]}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                </TouchableOpacity>

                <View style={[styles.contentContainer, { alignItems: 'center' }]}>
                    <View style={styles.headerHero}>
                        <Avatar
                            source={profile?.avatar_url || undefined}
                            name={profile?.full_name}
                            size="xl"
                        />
                        <Text style={[styles.name, { color: theme.text.primary, marginTop: spacing.xs, textAlign: 'center', alignSelf: 'center' }]}>
                            {profile?.full_name || 'Coach'}
                        </Text>
                        {locationString && (
                            <View style={styles.locationContainer}>
                                <Ionicons name="location-outline" size={16} color={theme.text.secondary} />
                                <Text style={[styles.location, { color: theme.text.secondary, textAlign: 'center' }]}>{locationString}</Text>
                            </View>
                        )}
                        <Button
                            label={t('editProfile')}
                            variant="ghost"
                            onPress={() => router.push('/profile/edit')}
                            style={styles.editButton}
                            leftIcon={<Ionicons name="create-outline" size={18} color={theme.status.warning} style={{ marginRight: spacing.xs }} />}
                            labelStyle={{ color: theme.text.primary, fontSize: typography.size.md, fontWeight: '600' }}
                        />
                    </View>
                </View>
            </View>

            {/* Body */}
            <View style={styles.bodyContainer}>
                {/* Deletion Pending Banner */}
                <View style={styles.contentContainer}>
                    <DeletionPendingBanner
                        onRehabilitationSuccess={() => showSuccess(t('profile.accountRestored'), t('profile.accountRestoredDetail'))}
                        onRehabilitationError={(msg: string) => showError(t('auth.error'), msg)}
                    />
                </View>

                <ScrollView 
                    contentContainerStyle={[
                        styles.scrollContent, 
                        { 
                            alignItems: 'center',
                            paddingBottom: spacing.xxl + insets.bottom + (Platform.OS === 'android' ? 32 : 0)
                        }
                    ]}
                >
                    <View style={styles.contentContainer}>

                        {/* Personal Info Card */}
                        <Card style={styles.card} padding="md">
                            <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t('personalInfo')}</Text>
                            <DetailItem
                                label={t('email')}
                                value={profile?.email || '-'}
                                icon="mail-outline"
                            />
                            <DetailItem
                                label={t('role')}
                                value={academyRole ? getRoleDisplayName(academyRole) : '-'}
                                icon="person-circle-outline"
                            />
                            <DetailItem
                                label={t('phone')}
                                value={profile?.phone || '-'}
                                icon="call-outline"
                            />
                            <DetailItem
                                label={t('country')}
                                value={countryName || '-'}
                                icon="flag-outline"
                            />
                            <DetailItem
                                label={t('stateProvince')}
                                value={stateName || '-'}
                                icon="map-outline"
                            />
                            <DetailItem
                                label={t('city')}
                                value={profile?.city || '-'}
                                icon="location-outline"
                            />
                            <DetailItem
                                label={t('postalCode')}
                                value={profile?.postal_code || '-'}
                                icon="mail-outline"
                            />
                        </Card>

                        {/* About Me Card */}
                        <Card style={styles.card} padding="md">
                            <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t('aboutMe')}</Text>
                            <Text style={[styles.bioText, { color: theme.text.primary }]}>{profile?.bio || '-'}</Text>
                        </Card>

                        {/* Subscription Plan Card */}
                        <Card style={styles.card} padding="md">
                            <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t('profile.subscriptionPlan')}</Text>
                            <View style={styles.planRow}>
                                <View style={styles.planInfo}>
                                    <View style={styles.planTierRow}>
                                        <Text style={[styles.planTier, { color: theme.text.primary }]}>{tierLabel}</Text>
                                        {isBeta && (
                                            <View style={[styles.betaBadge, { backgroundColor: theme.components.button.primary.bg }]}>
                                                <Text style={styles.betaBadgeText}>BETA</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.planDescription, { color: theme.text.secondary }]}>
                                        {isBeta ? t('profile.betaFullAccess') : t('profile.currentPlan')}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={isActive ? "checkmark-circle" : "alert-circle"}
                                    size={28}
                                    color={isActive ? theme.status.success : theme.status.warning}
                                />
                            </View>
                        </Card>

                        {/* Settings Card */}
                        <Card style={styles.card} padding="md">
                            <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t('settings')}</Text>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={() => setThemeModalVisible(true)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={20} color={theme.text.primary} />
                                    <Text style={[styles.settingText, { color: theme.text.primary }]}>{t('profile.appearance')}</Text>
                                </View>
                                <View style={styles.settingRight}>
                                    <Text style={[styles.settingValue, { color: theme.text.secondary }]}>
                                        {themeMode === 'light' ? t('profile.theme.light') : themeMode === 'dark' ? t('profile.theme.dark') : t('profile.theme.system')}
                                    </Text>
                                    <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={toggleLanguage}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="language-outline" size={20} color={theme.text.primary} />
                                    <Text style={[styles.settingText, { color: theme.text.primary }]}>{t('changeLanguage')}</Text>
                                </View>
                                <View style={styles.settingRight}>
                                    <Text style={[styles.settingValue, { color: theme.text.secondary }]}>
                                        {i18n.language.startsWith('en') ? 'English' : 'Español'}
                                    </Text>
                                    <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={() => router.push('/profile/privacy')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color={theme.text.primary} />
                                    <Text style={[styles.settingText, { color: theme.text.primary }]}>{t('profile.privacyPolicy')}</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={() => router.push('/profile/terms')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="document-text-outline" size={20} color={theme.text.primary} />
                                    <Text style={[styles.settingText, { color: theme.text.primary }]}>{t('profile.termsConditions')}</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={handleResetPassword}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="lock-closed-outline" size={20} color={theme.text.primary} />
                                    <Text style={[styles.settingText, { color: theme.text.primary }]}>{t('resetPassword')}</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, { borderBottomColor: theme.border.subtle }]}
                                onPress={handleLogout}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="log-out-outline" size={20} color={theme.status.error} />
                                    <Text style={[styles.settingText, { color: theme.status.error }]}>{t('logout')}</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.settingItem, styles.settingItemLast]}
                                onPress={() => setDeleteModalVisible(true)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                    <Text style={[styles.settingText, { color: theme.status.error }]}>{t('profile.deleteAccount')}</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>
                        </Card>
                    </View>
                </ScrollView>
            </View>

            {/* Specialized modals remain as needed */}
            <DeleteAccountModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
            />

            <Modal
                transparent
                visible={themeModalVisible}
                animationType="fade"
                onRequestClose={() => setThemeModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setThemeModalVisible(false)}
                >
                    <View style={[styles.modalContainer, { backgroundColor: theme.background.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{t('profile.chooseTheme')}</Text>

                        {['light', 'dark', 'system'].map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.themeOption,
                                    { borderBottomColor: theme.border.subtle },
                                    themeMode === mode && { backgroundColor: theme.background.default }
                                ]}
                                onPress={() => {
                                    setThemeMode(mode as any);
                                    setThemeModalVisible(false);
                                }}
                            >
                                <Text style={[
                                    styles.themeOptionText,
                                    { color: theme.text.primary },
                                    themeMode === mode && { fontWeight: '700', color: theme.components.button.primary.bg }
                                ]}>
                                    {mode === 'light' ? t('profile.theme.light') : mode === 'dark' ? t('profile.theme.dark') : t('profile.theme.system')}
                                </Text>
                                {themeMode === mode && (
                                    <Ionicons name="checkmark" size={20} color={theme.components.button.primary.bg} />
                                )}
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setThemeModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.text.secondary }]}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View >
    );
}

const DetailItem = ({ label, value, icon }: { label: string; value: string; icon: any }) => {
    const { theme, isDark } = useTheme();
    const styles = createStyles(theme);
    return (
        <View style={[styles.detailItem, { borderBottomColor: theme.border.subtle }]}>
        <View style={styles.iconContainer}>
            <Ionicons name={icon} size={22} color={theme.text.secondary} />
        </View>
            <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: theme.text.secondary }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: theme.text.primary }]}>{value}</Text>
            </View>
        </View>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    headerContainer: {
        width: '100%',
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButtonAbsolute: {
        position: 'absolute',
        top: 8,
        left: spacing.md,
        padding: 4,
        zIndex: 10,
    },
    headerHero: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
    },
    bodyContainer: {
        flex: 1,
        backgroundColor: theme.background.default,
        paddingTop: spacing.md,
    },
    name: {
        ...typography.variants.h2,
        color: theme.text.primary,
        marginTop: spacing.sm,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 4,
    },
    location: {
        ...typography.variants.bodyMedium,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    editButton: {
        marginTop: 4,
        minWidth: 140,
        alignSelf: 'center',
    },
    card: {
        marginBottom: spacing.md,
        borderWidth: 0, // Remove default border
        elevation: 0,   // Remove shadow if any
    },
    cardTitle: {
        ...typography.variants.label,
        color: theme.text.secondary,
        marginBottom: spacing.sm,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        ...typography.variants.labelSmall,
        fontWeight: '500',
    },
    detailValue: {
        ...typography.variants.bodyLarge,
        fontWeight: '600',
        marginTop: 2,
    },
    bioText: {
        ...typography.variants.bodyLarge,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        width: '100%',
    },
    settingItemLast: {
        borderBottomWidth: 0,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    settingText: {
        ...typography.variants.bodyLarge,
        fontWeight: '500',
    },
    settingValue: {
        ...typography.variants.bodyMedium,
    },
    settingSubtext: {
        ...typography.variants.bodySmall,
        marginTop: 2,
    },
    // Subscription Plan styles
    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    planInfo: {
        flex: 1,
    },
    planTierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    planTier: {
        ...typography.variants.h3,
    },
    planDescription: {
        ...typography.variants.bodyMedium,
        marginTop: 4,
    },
    betaBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
    },
    betaBadgeText: {
        ...typography.variants.labelSmall,
        color: 'white',
        letterSpacing: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        ...typography.variants.h3,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderRadius: 8,
    },
    themeOptionText: {
        ...typography.variants.bodyLarge,
    },
    closeButton: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    closeButtonText: {
        ...typography.variants.bodyLarge,
        fontWeight: '500',
    },
});
