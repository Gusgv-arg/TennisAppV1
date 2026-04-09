import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { Modal } from './Modal';
import { showError, showSuccess } from '@/src/utils/toast';
import Toast from 'react-native-toast-message';
import { toastConfig } from './ToastConfig';
import { Button, spacing, typography } from '../design';
import { Theme } from '../design/theme';
import { useFeedbackMutations } from '../features/feedback/hooks/useFeedback';
import { useTheme } from '../hooks/useTheme';
import type { FeedbackType } from '../types/feedback';

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    screenName?: string;
}

export default function FeedbackModal({ visible, onClose, screenName }: FeedbackModalProps) {
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { createFeedback } = useFeedbackMutations();

    const [selectedType, setSelectedType] = useState<FeedbackType>('suggestion');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const feedbackTypes: { type: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
        { type: 'bug', label: t('feedback.bug'), icon: 'bug-outline', color: theme.status.error },
        { type: 'suggestion', label: t('feedback.suggestion'), icon: 'bulb-outline', color: theme.components.button.primary.bg },
        { type: 'question', label: t('feedback.question'), icon: 'help-circle-outline', color: theme.status.warning },
    ];

    const handleSubmit = async () => {
        if (!description.trim()) {
            showError(t('feedback.error'), t('feedback.descriptionRequired'));
            return;
        }

        setIsSubmitting(true);
        try {
            await createFeedback.mutateAsync({
                feedback_type: selectedType,
                description: description.trim(),
                screen_name: screenName,
                metadata: {
                    platform: Platform.OS,
                    timestamp: new Date().toISOString(),
                },
            });

            // Close modal immediately after success
            handleClose();
            
            // Show success toast after modal animation
            setTimeout(() => {
                showSuccess(
                    t('feedback.success'),
                    t('feedback.thankYou')
                );
            }, 400);
        } catch (error) {
            showError(t('feedback.error'), t('feedback.submitError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setDescription('');
        setSelectedType('suggestion');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent={Platform.OS === 'android'}
        >
            <View style={[
                styles.desktopOverlay, 
                { backgroundColor: theme.background.backdrop },
                Platform.OS !== 'web' && !isDesktop && styles.mobileOverlay
            ]}>
                <View
                    style={[
                        !isDesktop && styles.container,
                        { backgroundColor: theme.background.surface, shadowColor: '#000' },
                        isDesktop && styles.desktopContainer,
                    ]}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>{t('feedback.title')}</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.content} 
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                        bounces={false}
                    >
                        {/* Beta Message */}
                        <View style={[styles.betaMessage, { backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="information-circle" size={20} color={theme.components.button.primary.bg} />
                            <Text style={[styles.betaText, { color: theme.text.secondary }]}>{t('feedback.betaMessage')}</Text>
                        </View>

                        {/* Feedback Type Selection */}
                        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t('feedback.typeLabel')}</Text>
                        <View style={styles.typeContainer}>
                            {feedbackTypes.map((item) => (
                                <TouchableOpacity
                                    key={item.type}
                                    style={[
                                        styles.typeButton,
                                        { borderColor: theme.border.default, backgroundColor: theme.background.surface },
                                        selectedType === item.type && { borderColor: item.color, backgroundColor: theme.background.subtle },
                                    ]}
                                    onPress={() => setSelectedType(item.type)}
                                >
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={selectedType === item.type ? item.color : theme.text.tertiary}
                                    />
                                    <Text
                                        style={[
                                            styles.typeLabel,
                                            { color: theme.text.secondary },
                                            selectedType === item.type && { color: item.color, fontWeight: '600' },
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Description */}
                        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t('feedback.descriptionLabel')}</Text>
                        <TextInput
                            style={[styles.textArea, { borderColor: theme.border.default, color: theme.text.primary, backgroundColor: theme.background.input }]}
                            placeholder={t('feedback.descriptionPlaceholder')}
                            placeholderTextColor={theme.text.tertiary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={1000}
                        />
                        <Text style={[styles.charCount, { color: theme.text.tertiary }]}>
                            {description.length}/1000
                        </Text>

                        {/* Screen Context */}
                        {screenName && (
                            <View style={styles.contextInfo}>
                                <Ionicons name="location-outline" size={14} color={theme.text.tertiary} />
                                <Text style={[styles.contextText, { color: theme.text.secondary }]}>
                                    {t('feedback.screenContext')}: {screenName}
                                </Text>
                            </View>
                        )}

                        {/* Contact Notice */}
                        <Text style={[styles.contactNotice, { color: theme.text.tertiary }]}>
                            {t('feedback.thankYou')}
                        </Text>

                        {/* Submit Button */}
                        <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                            <View style={{ width: '100%', maxWidth: 200 }}>
                                <Button
                                    label={isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
                                    onPress={handleSubmit}
                                    disabled={isSubmitting || !description.trim()}
                                    style={{ width: '100%' }}
                                    leftIcon={
                                        isSubmitting ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : undefined
                                    }
                                />
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
            {/* Modal-local Toast to ensure visibility on web/mobile fullscreen modals */}
            <Toast config={toastConfig} topOffset={40} />
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    flex1: {
        flex: 1,
    },
    container: {
        width: '100%',
        maxWidth: 420,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        ...(Platform.OS !== 'web' && {
            height: Platform.OS === 'android' ? 'auto' : '92%',
            maxHeight: '92%',
            borderBottomLeftRadius: Platform.OS === 'android' ? 0 : 24,
            borderBottomRightRadius: Platform.OS === 'android' ? 0 : 24,
        })
    },
    desktopOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    mobileOverlay: {
        justifyContent: 'flex-end',
        padding: 0,
    },
    desktopContainer: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        borderRadius: 20,
        height: 'auto',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md, // Reduced from lg
        paddingVertical: spacing.sm, // Reduced from md
        borderBottomWidth: 1,
    },
    title: {
        fontSize: typography.size.lg, // Reduced from xl
        fontWeight: '700',
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        paddingHorizontal: spacing.md, // Reduced from lg
        paddingTop: spacing.sm, // Reduced from md
    },
    scrollContent: {
        paddingBottom: spacing.xxxl,
    },
    betaMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm, // Reduced from md
        borderRadius: 8,
        marginBottom: spacing.md, // Reduced from lg
        gap: spacing.sm,
    },
    betaText: {
        flex: 1,
        fontSize: typography.size.xs, // Reduced from sm
        color: theme.components.button.primary.bg,
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: typography.size.sm, // Reduced from md
        fontWeight: '600',
        marginBottom: 4, // Reduced from spacing.sm
    },
    contactNotice: {
        fontSize: typography.size.xs,
        textAlign: 'center',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md, // Reduced from lg
    },
    typeButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        padding: spacing.sm, // Reduced from md
        borderRadius: 8, // Reduced radius
        borderWidth: 1, // Reduced width
        gap: 4, // Reduced gap
    },
    typeButtonSelected: {
        borderWidth: 1,
    },
    typeLabel: {
        fontSize: typography.size.xs, // Reduced from sm
    },
    textArea: {
        borderWidth: 1,
        borderRadius: 8,
        padding: spacing.sm, // Reduced from md
        fontSize: typography.size.sm, // Reduced from md
        minHeight: 150, // Increased to 150 per user request
        maxHeight: 200,
    },
    charCount: {
        fontSize: 10, // Explicitly small
        textAlign: 'right',
        marginTop: 2,
        marginBottom: spacing.sm, // Reduced from md
    },
    contextInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md, // Reduced from lg
    },
    contextText: {
        fontSize: typography.size.xs,
    },
});
