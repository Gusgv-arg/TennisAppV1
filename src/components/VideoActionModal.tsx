import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { HelpIcon } from '@/src/design/components/HelpIcon';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';

interface VideoActionModalProps {
    visible: boolean;
    onClose: () => void;
    onRecordPress: () => void;
    onLibraryPress: () => void;
}

export const VideoActionModal = ({ visible, onClose, onRecordPress, onLibraryPress }: VideoActionModalProps) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [helpVisible, setHelpVisible] = React.useState(false);

    const showVideosHelp = () => {
        setHelpVisible(true);
    };

    const helpItems: HelpItem[] = [
        {
            icon: 'analytics-outline',
            title: t('videoHub.modals.help.items.analysis.title'),
            description: t('videoHub.modals.help.items.analysis.desc')
        },
        {
            icon: 'phone-portrait-outline',
            title: t('videoHub.modals.help.items.studentApp.title'),
            description: t('videoHub.modals.help.items.studentApp.desc')
        },
        {
            icon: 'library-outline',
            title: t('videoHub.modals.help.items.library.title'),
            description: t('videoHub.modals.help.items.library.desc')
        }
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View 
                style={styles.overlay} 
            >
                <BlurView 
                    intensity={Platform.OS === 'ios' ? 40 : 60} 
                    tint="dark" 
                    style={StyleSheet.absoluteFill} 
                />
                <TouchableOpacity 
                    style={StyleSheet.absoluteFill} 
                    activeOpacity={1} 
                    onPress={onClose} 
                />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('videoHub.title')}</Text>
                        <View style={styles.helpIconContainer}>
                            <HelpIcon size={16} onPress={showVideosHelp} />
                        </View>
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.option} 
                        onPress={() => {
                            onClose();
                            onRecordPress();
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: theme.components.button.primary.bg }]}>
                            <Ionicons name="videocam" size={24} color="white" />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>{t('videoHub.record')}</Text>
                            <Text style={styles.optionSubtitle}>Graba un golpe o sube desde tu galería</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity 
                        style={styles.option} 
                        onPress={() => {
                            onClose();
                            onLibraryPress();
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: theme.status.info }]}>
                            <Ionicons name="library" size={24} color="white" />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>{t('videoHub.library')}</Text>
                            <Text style={styles.optionSubtitle}>Accede a todos tus videos generales</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>{t('cancel')}</Text>
                    </TouchableOpacity>

                    <HelpModal 
                        visible={helpVisible}
                        onClose={() => setHelpVisible(false)}
                        title={t('videoHub.modals.help.title')}
                        items={helpItems}
                    />
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => {
    const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)', // Slightly transparent so blur shows through
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        content: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: theme.background.surface,
            borderRadius: 20,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 10,
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: theme.text.primary,
            textAlign: 'center',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            width: '100%',
        },
        helpIconContainer: {
            position: 'absolute',
            right: 0,
            top: 2,
        },
        option: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
        },
        iconContainer: {
            width: 48,
            height: 48,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
        },
        optionTextContainer: {
            flex: 1,
        },
        optionTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.text.primary,
            marginBottom: 2,
        },
        optionSubtitle: {
            fontSize: 13,
            color: theme.text.secondary,
        },
        divider: {
            height: 1,
            backgroundColor: theme.border.subtle,
            width: '100%',
        },
        closeButton: {
            marginTop: 24,
            paddingVertical: 12,
            alignItems: 'center',
        },
        closeButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.text.tertiary,
        },
    });
};
