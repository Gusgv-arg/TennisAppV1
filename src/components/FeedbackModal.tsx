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
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{t('feedback.title')}</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.neutral[600]} />
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
                                    size={24}
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
                        numberOfLines={6}
                        textAlignVertical="top"
                        maxLength={1000}
                    />
                    <Text style={styles.charCount}>
                        {description.length}/1000
                    </Text>

                    {/* Screen Context */}
                    {screenName && (
                        <View style={styles.contextInfo}>
                            <Ionicons name="location-outline" size={16} color={colors.neutral[500]} />
                            <Text style={styles.contextText}>
                                {t('feedback.screenContext')}: {screenName}
                            </Text>
                        </View>
                    )}

                    {/* Submit Button */}
                    <Button
                        label={isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
                        onPress={handleSubmit}
                        disabled={isSubmitting || !description.trim()}
                        style={styles.submitButton}
                        leftIcon={
                            isSubmitting ? (
                                <ActivityIndicator size="small" color={colors.common.white} />
                            ) : undefined
                        }
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    betaMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        padding: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    betaText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.primary[700],
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: spacing.sm,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.neutral[200],
        backgroundColor: colors.common.white,
        gap: spacing.xs,
    },
    typeButtonSelected: {
        backgroundColor: colors.neutral[50],
        borderWidth: 2,
    },
    typeLabel: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 8,
        padding: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[900],
        minHeight: 120,
        maxHeight: 200,
    },
    charCount: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        textAlign: 'right',
        marginTop: spacing.xs,
        marginBottom: spacing.md,
    },
    contextInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.lg,
    },
    contextText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    submitButton: {
        marginBottom: spacing.xl,
    },
});
