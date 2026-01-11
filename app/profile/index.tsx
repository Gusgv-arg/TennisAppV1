import { Ionicons } from '@expo/vector-icons';
import { Country, State } from 'country-state-city';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { supabase } from '../../src/services/supabaseClient';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { profile: authProfile } = useAuthStore();
    const { data: profile } = useProfile();
    const { role: academyRole } = usePermissions();
    const {
        isEnabled: paymentsEnabled,
        isSimplifiedMode,
        enablePayments,
        disablePayments
    } = usePaymentSettings();

    const [modalVisible, setModalVisible] = useState(false);
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

    const handleTogglePayments = async (value: boolean) => {
        if (!value) {
            // Confirm disabling
            const message = 'Si desactivas el módulo de pagos, no podrás ver el historial ni los balances hasta que lo vuelvas a activar. ¿Continuar?';

            if (Platform.OS === 'web') {
                if (!window.confirm(message)) return;
            } else {
                return new Promise((resolve) => {
                    Alert.alert(
                        'Desactivar Módulo',
                        message,
                        [
                            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
                            { text: 'Desactivar', style: 'destructive', onPress: () => resolve(true) }
                        ]
                    );
                }).then(confirm => {
                    if (confirm) disablePayments();
                });
            }
            disablePayments();
        } else {
            // Enabling via profile just turns it on with current simplified setting or false
            await enablePayments({ simplified: isSimplifiedMode });
        }
    };

    const handleToggleSimplified = async (value: boolean) => {
        await enablePayments({ simplified: value });
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="person-circle" size={30} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Mi Perfil</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Description Section */}
            <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>
                    Tu información personal y preferencias
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header with Avatar */}
                <View style={styles.header}>
                    <Avatar
                        source={profile?.avatar_url || undefined}
                        name={profile?.full_name}
                        size="xl"
                    />
                    <Text style={styles.name}>{profile?.full_name || 'Coach'}</Text>
                    {locationString && (
                        <View style={styles.locationContainer}>
                            <Ionicons name="location-outline" size={16} color={colors.neutral[500]} />
                            <Text style={styles.location}>{locationString}</Text>
                        </View>
                    )}
                    <Button
                        label={t('editProfile')}
                        variant="outline"
                        size="sm"
                        onPress={() => router.push('/profile/edit')}
                        style={styles.editButton}
                        leftIcon={<Ionicons name="create-outline" size={16} color={colors.primary[500]} style={{ marginRight: spacing.xs }} />}
                    />
                </View>

                {/* Personal Info Card */}
                <Card style={styles.card} padding="md">
                    <Text style={styles.cardTitle}>{t('personalInfo')}</Text>
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
                    <Text style={styles.cardTitle}>{t('aboutMe')}</Text>
                    <Text style={styles.bioText}>{profile?.bio || '-'}</Text>
                </Card>

                {/* Payments Settings Card */}
                <Card style={styles.card} padding="md">
                    <Text style={styles.cardTitle}>Pagos y Privacidad</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="wallet-outline" size={20} color={colors.neutral[600]} />
                            <Text style={styles.settingText}>Módulo de pagos</Text>
                        </View>
                        <Switch
                            value={paymentsEnabled}
                            onValueChange={handleTogglePayments}
                            trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                            thumbColor={paymentsEnabled ? colors.primary[500] : colors.neutral[100]}
                        />
                    </View>

                    <View style={[styles.settingItem, styles.settingItemLast]}>
                        <View style={styles.settingLeft}>
                            <Ionicons
                                name={isSimplifiedMode ? "shield-checkmark-outline" : "eye-outline"}
                                size={20}
                                color={colors.neutral[600]}
                            />
                            <View>
                                <Text style={styles.settingText}>Modo simplificado</Text>
                                <Text style={styles.settingSubtext}>Ocultar montos exactos de dinero</Text>
                            </View>
                        </View>
                        <Switch
                            value={isSimplifiedMode}
                            onValueChange={handleToggleSimplified}
                            disabled={!paymentsEnabled}
                            trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                            thumbColor={isSimplifiedMode ? colors.primary[500] : colors.neutral[100]}
                        />
                    </View>
                </Card>

                {/* Settings Card */}
                <Card style={styles.card} padding="md">
                    <Text style={styles.cardTitle}>{t('settings')}</Text>

                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={toggleLanguage}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="language-outline" size={20} color={colors.neutral[600]} />
                            <Text style={styles.settingText}>{t('changeLanguage')}</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>
                                {i18n.language === 'en' ? 'English' : 'Español'}
                            </Text>
                            <Ionicons name="chevron-forward-outline" size={20} color={colors.neutral[400]} />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={handleResetPassword}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.neutral[600]} />
                            <Text style={styles.settingText}>{t('resetPassword')}</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.settingItem, styles.settingItemLast]}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="log-out-outline" size={20} color={colors.error[500]} />
                            <Text style={[styles.settingText, { color: colors.error[500] }]}>{t('logout')}</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>
                </Card>
            </ScrollView>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={modalConfig.onClose}
            />
        </View>
    );
}

const DetailItem = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
    <View style={styles.detailItem}>
        <View style={styles.iconContainer}>
            <Ionicons name={icon} size={18} color={colors.primary[500]} />
        </View>
        <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
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
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
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
});
