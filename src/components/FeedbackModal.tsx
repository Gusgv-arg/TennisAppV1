import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { Button, colors, spacing, typography } from '../design';
import { useFeedbackMutations } from '../features/feedback/hooks/useFeedback';
import type { FeedbackType } from '../types/feedback';

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    screenName?: string;
}

export default function FeedbackModal({ visible, onClose, screenName }: FeedbackModalProps) {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const { createFeedback } = useFeedbackMutations();

    const [selectedType, setSelectedType] = useState<FeedbackType>('suggestion');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const feedbackTypes: { type: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
        { type: 'bug', label: t('feedback.bug'), icon: 'bug-outline', color: colors.error[500] },
        { type: 'suggestion', label: t('feedback.suggestion'), icon: 'bulb-outline', color: colors.primary[500] },
        { type: 'question', label: t('feedback.question'), icon: 'help-circle-outline', color: colors.warning[500] },
    ];

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert(t('feedback.error'), t('feedback.descriptionRequired'));
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
        } catch (error) {
            Alert.alert(t('feedback.error'), t('feedback.submitError'));
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
            animationType={isDesktop ? "fade" : "slide"}
            transparent={isDesktop}
            presentationStyle={isDesktop ? 'overFullScreen' : 'pageSheet'}
            onRequestClose={handleClose}
        >
            <View style={isDesktop ? styles.desktopOverlay : { flex: 1 }}>
                <KeyboardAvoidingView
                    style={[styles.container, isDesktop && styles.desktopContainer]}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('feedback.title')}</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.neutral[600]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Beta Message */}
                        <View style={styles.betaMessage}>
                            <Ionicons name="information-circle" size={20} color={colors.primary[500]} />
                            <Text style={styles.betaText}>{t('feedback.betaMessage')}</Text>
                        </View>

                        {/* Feedback Type Selection */}
                        <Text style={styles.sectionTitle}>{t('feedback.typeLabel')}</Text>
                        <View style={styles.typeContainer}>
                            {feedbackTypes.map((item) => (
                                <TouchableOpacity
                                    key={item.type}
                                    style={[
                                        styles.typeButton,
                                        selectedType === item.type && styles.typeButtonSelected,
                                        selectedType === item.type && { borderColor: item.color },
                                    ]}
                                    onPress={() => setSelectedType(item.type)}
                                >
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={selectedType === item.type ? item.color : colors.neutral[400]}
                                    />
                                    <Text
                                        style={[
                                            styles.typeLabel,
                                            selectedType === item.type && { color: item.color, fontWeight: '600' },
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Description */}
                        <Text style={styles.sectionTitle}>{t('feedback.descriptionLabel')}</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder={t('feedback.descriptionPlaceholder')}
                            placeholderTextColor={colors.neutral[400]}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={1000}
                        />
                        <Text style={styles.charCount}>
                            {description.length}/1000
                        </Text>

                        {/* Screen Context */}
                        {screenName && (
                            <View style={styles.contextInfo}>
                                <Ionicons name="location-outline" size={14} color={colors.neutral[500]} />
                                <Text style={styles.contextText}>
                                    {t('feedback.screenContext')}: {screenName}
                                </Text>
                            </View>
                        )}

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
                                            <ActivityIndicator size="small" color={colors.common.white} />
                                        ) : undefined
                                    }
                                />
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    desktopOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.sm,
    },
    desktopContainer: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md, // Reduced from lg
        paddingVertical: spacing.sm, // Reduced from md
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.lg, // Reduced from xl
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.md, // Reduced from lg
        paddingTop: spacing.sm, // Reduced from md
    },
    betaMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        padding: spacing.sm, // Reduced from md
        borderRadius: 8,
        marginBottom: spacing.md, // Reduced from lg
        gap: spacing.sm,
    },
    betaText: {
        flex: 1,
        fontSize: typography.size.xs, // Reduced from sm
        color: colors.primary[700],
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: typography.size.sm, // Reduced from md
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: 4, // Reduced from spacing.sm
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
        borderColor: colors.neutral[200],
        backgroundColor: colors.common.white,
        gap: 4, // Reduced gap
    },
    typeButtonSelected: {
        backgroundColor: colors.neutral[50],
        borderWidth: 1,
    },
    typeLabel: {
        fontSize: typography.size.xs, // Reduced from sm
        color: colors.neutral[600],
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 8,
        padding: spacing.sm, // Reduced from md
        fontSize: typography.size.sm, // Reduced from md
        color: colors.neutral[900],
        minHeight: 150, // Increased to 150 per user request
        maxHeight: 200,
    },
    charCount: {
        fontSize: 10, // Explicitly small
        color: colors.neutral[500],
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
        color: colors.neutral[600],
    },
});
