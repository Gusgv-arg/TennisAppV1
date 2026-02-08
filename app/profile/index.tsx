import { Ionicons } from '@expo/vector-icons';
import { Country, State } from 'country-state-city';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import DeleteAccountModal from '@/src/features/profile/components/DeleteAccountModal';
import DeletionPendingBanner from '@/src/features/profile/components/DeletionPendingBanner';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { useSubscription } from '@/src/features/subscription/hooks/useSubscription';
import { getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { useTheme } from '@/src/hooks/useTheme';
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

    const [themeModalVisible, setThemeModalVisible] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: StatusType;
        title: string;
        message: string;
        onClose: () => void;
    }>({
        type: 'info',
        title: '',
        message: '',
        onClose: () => setModalVisible(false)
    });

    const showModal = (type: StatusType, title: string, message: string, onClose?: () => void) => {
        setModalConfig({
            type,
            title,
            message,
            onClose: () => {
                setModalVisible(false);
                if (onClose) onClose();
            }
        });
        setModalVisible(true);
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showModal('error', 'Error', error.message);
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'es' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleResetPassword = async () => {
        if (!authProfile?.email) return;

        const { error } = await supabase.auth.resetPasswordForEmail(authProfile.email, {
            redirectTo: Linking.createURL('reset-password'),
        });

        if (error) {
            showModal('error', t('saveError'), error.message);
        } else {
            showModal('success', t('resetPassword'), t('passwordResetEmailSent'));
        }
    };

    // Helper to get state name from code
    const getStateName = () => {
        if (!profile?.state_province || !profile?.country) return null;

        const state = State.getStateByCodeAndCountry(profile.state_province, profile.country);
        return state?.name || profile.state_province; // Fallback to code if not found
    };

    // Helper to get country name from code
    const getCountryName = () => {
        if (!profile?.country) return null;

        const country = Country.getCountryByCode(profile.country);
        return country?.name || profile.country; // Fallback to code if not found
    };

    // Construct location string from ISO codes
    const getLocationString = () => {
        const parts = [];

        // Get city name (already stored as name, not code)
        if (profile?.city) {
            parts.push(profile.city);
        }

        // Get state/province name
        const stateName = getStateName();
        if (stateName) {
            parts.push(stateName);
        }

        // Get country name
        const countryName = getCountryName();
        if (countryName) {
            parts.push(countryName);
        }

        return parts.length > 0 ? parts.join(', ') : null;
    };

    const locationString = getLocationString();



    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            <Stack.Screen
                options={{
                    headerStyle: { backgroundColor: theme.background.default },
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="person-circle" size={30} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                            <Text style={[styles.headerTitleText, { color: theme.text.primary }]}>Mi Perfil</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Deletion Pending Banner */}
            <View style={styles.contentContainer}>
                <DeletionPendingBanner
                    onRehabilitationSuccess={() => showModal('success', '¡Cuenta restaurada!', 'Tu cuenta y academias han sido reactivadas exitosamente.')}
                    onRehabilitationError={(msg) => showModal('error', 'Error', msg)}
                />
            </View>

            {/* Description Section */}
            <View style={[styles.descriptionSection, styles.contentContainer, { backgroundColor: theme.background.surface }]}>
                <Text style={[styles.descriptionText, { color: theme.text.secondary }]}>
                    Tu información personal y preferencias
                </Text>
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { alignItems: 'center' }]}>
                <View style={styles.contentContainer}>
                    {/* Header with Avatar */}
                    <View style={styles.header}>
                        <Avatar
                            source={profile?.avatar_url || undefined}
                            name={profile?.full_name}
                            size="xl"
                        />
                        <Text style={[styles.name, { color: theme.text.primary }]}>{profile?.full_name || 'Coach'}</Text>
                        {locationString && (
                            <View style={styles.locationContainer}>
                                <Ionicons name="location-outline" size={16} color={theme.text.secondary} />
                                <Text style={[styles.location, { color: theme.text.secondary }]}>{locationString}</Text>
                            </View>
                        )}
                        <Button
                            label={t('editProfile')}
                            variant="outline"
                            size="sm"
                            onPress={() => router.push('/profile/edit')}
                            style={styles.editButton}
                            leftIcon={<Ionicons name="create-outline" size={16} color={theme.components.button.primary.bg} style={{ marginRight: spacing.xs }} />}
                        />
                    </View>

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
                            value={getCountryName() || '-'}
                            icon="flag-outline"
                        />
                        <DetailItem
                            label={t('stateProvince')}
                            value={getStateName() || '-'}
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
                        <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>Plan de Suscripción</Text>
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
                                    {isBeta ? 'Acceso completo durante el período beta' : 'Tu plan actual'}
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
                                <Ionicons name="moon-outline" size={20} color={theme.text.primary} />
                                <Text style={[styles.settingText, { color: theme.text.primary }]}>Apariencia</Text>
                            </View>
                            <View style={styles.settingRight}>
                                <Text style={[styles.settingValue, { color: theme.text.secondary }]}>
                                    {themeMode === 'light' ? 'Claro' : themeMode === 'dark' ? 'Oscuro' : 'Automático'}
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
                                    {i18n.language === 'en' ? 'English' : 'Español'}
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
                                <Text style={[styles.settingText, { color: theme.text.primary }]}>Política de Privacidad</Text>
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
                                <Text style={[styles.settingText, { color: theme.text.primary }]}>Términos y Condiciones</Text>
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
                                <Text style={[styles.settingText, { color: theme.status.error }]}>Eliminar cuenta</Text>
                            </View>
                            <Ionicons name="chevron-forward-outline" size={20} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </Card>
                </View>
            </ScrollView>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={modalConfig.onClose}
            />

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
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Elige un tema</Text>

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
                                    {mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Automático (Sistema)'}
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
                            <Text style={[styles.closeButtonText, { color: theme.text.secondary }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View >
    );
}

const DetailItem = ({ label, value, icon }: { label: string; value: string; icon: any }) => {
    const { theme } = useTheme();
    return (
        <View style={[styles.detailItem, { borderBottomColor: theme.border.subtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.components.button.primary.bg + '15' }]}>
                <Ionicons name={icon} size={18} color={theme.components.button.primary.bg} />
            </View>
            <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: theme.text.secondary }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: theme.text.primary }]}>{value}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
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
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.common.white,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginTop: spacing.md,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    location: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        fontWeight: '500',
    },
    editButton: {
        marginTop: spacing.md,
        minWidth: 140,
    },
    card: {
        marginBottom: spacing.md,
    },
    cardTitle: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.neutral[500],
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
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        fontWeight: '500',
    },
    detailValue: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
        fontWeight: '600',
        marginTop: 2,
    },
    bioText: {
        fontSize: typography.size.md,
        color: colors.neutral[800],
        lineHeight: 22,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        width: '100%',
        maxWidth: 360,
        alignSelf: 'center',
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
        fontSize: typography.size.md,
        color: colors.neutral[800],
        fontWeight: '500',
    },
    settingValue: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    settingSubtext: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
    // Subscription Plan styles
    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 360,
        alignSelf: 'center',
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
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    planDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: 4,
    },
    betaBadge: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
    },
    betaBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: '700',
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
        fontSize: typography.size.lg,
        fontWeight: '700',
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
        fontSize: typography.size.md,
    },
    closeButton: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: typography.size.md,
        fontWeight: '500',
    },
});
