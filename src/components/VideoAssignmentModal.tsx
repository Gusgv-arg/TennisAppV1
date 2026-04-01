import { Avatar } from '@/src/design/components/Avatar';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from './Modal';

interface VideoAssignmentModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectPlayer: (playerId: string | null, title: string, stroke: string | null, playerName?: string | null) => void;
    isUploading?: boolean;
}

export default function VideoAssignmentModal({ visible, onClose, onSelectPlayer, isUploading }: VideoAssignmentModalProps) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [searchQuery, setSearchQuery] = useState('');
    const { data: players } = usePlayers(searchQuery, 'active');

    const [title, setTitle] = useState('');
    const [selectedStroke, setSelectedStroke] = useState<string | null>(null);

    const strokes = [
        { id: 'Serve', label: t('videoHub.strokes.serve') },
        { id: 'Forehand', label: t('videoHub.strokes.drive') },
        { id: 'Backhand', label: t('videoHub.strokes.backhand') },
        { id: 'Volley', label: t('videoHub.strokes.volley') },
        { id: 'Smash', label: t('videoHub.strokes.smash') }
    ];

    React.useEffect(() => {
        if (visible) {
            const date = new Date();
            setTitle(`Video ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            setSelectedStroke(null);
            setSearchQuery('');
        }
    }, [visible]);

    const handleSelect = (playerId: string | null, playerName?: string | null) => {
        onSelectPlayer(playerId, title, selectedStroke, playerName);
    };

    const renderHeader = () => (
        <View>
            <View style={styles.handleContainer}>
                <View style={styles.handle} />
            </View>
            <View style={styles.header}>
                <Text style={styles.title}>{t('videoHub.modals.assignment.title')}</Text>
                <TouchableOpacity onPress={onClose} disabled={isUploading} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={theme.text.secondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>{t('videoHub.modals.assignment.titleLabel').toUpperCase()}</Text>
                <Input
                    placeholder="Escribe un título..."
                    value={title}
                    onChangeText={setTitle}
                    style={styles.input}
                    inputContainerStyle={styles.titleInputContainer}
                    containerStyle={{ marginBottom: 20 }}
                    placeholderTextColor={theme.text.tertiary}
                />

                <Text style={styles.sectionLabel}>{t('videoHub.modals.assignment.strokeLabel').toUpperCase()}</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                    style={{ marginBottom: 20 }}
                >
                    {strokes.map((stroke) => (
                        <TouchableOpacity
                            key={stroke.id}
                            style={[
                                styles.chip,
                                selectedStroke === stroke.id && styles.activeChip
                            ]}
                            onPress={() => setSelectedStroke(stroke.id)}
                        >
                            <Text style={[
                                styles.chipText,
                                selectedStroke === stroke.id && styles.activeChipText
                            ]}>{stroke.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 10, marginBottom: 10, paddingHorizontal: 20 }]}>
                {t('calendar.bulk.filters').toUpperCase()}
            </Text>

            <TouchableOpacity
                style={styles.generalOption}
                onPress={() => handleSelect(null, t('videoHub.library'))}
                disabled={isUploading}
            >
                <View style={[styles.iconContainer, { backgroundColor: theme.status.info }]}>
                    <Ionicons name="folder-open" size={20} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.generalOptionText}>{t('videoHub.modals.assignment.generalOption')}</Text>
                    <Text style={styles.generalOptionSub}>{t('videoHub.modals.assignment.generalSubtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={theme.text.secondary} style={styles.searchIcon} />
                <Input
                    placeholder={t('videoHub.modals.assignment.searchPlaceholder')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    containerStyle={{ flex: 1 }}
                    inputContainerStyle={styles.searchInputContainer}
                    placeholderTextColor={theme.text.tertiary}
                />
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <FlatList
                        data={searchQuery.length > 0 ? players : []}
                        keyExtractor={(item) => item.id}
                        ListHeaderComponent={renderHeader}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.playerItem}
                                onPress={() => handleSelect(item.id, item.full_name)}
                                disabled={isUploading}
                            >
                                <Avatar name={item.full_name} source={item.avatar_url} size="sm" />
                                <Text style={styles.playerName}>{item.full_name}</Text>
                                <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                {searchQuery.length > 0 ? (
                                    <Text style={styles.emptyText}>{t('players.emptyState.noPlayers')}</Text>
                                ) : (
                                    <Text style={styles.helperText}>{t('videoHub.modals.assignment.searchPlaceholder')}</Text>
                                )}
                            </View>
                        }
                    />
                    {isUploading && (
                        <View style={styles.modalLoadingOverlay}>
                            <ActivityIndicator size="large" color="white" />
                            <Text style={styles.modalLoadingText}>{t('videoHub.modals.assignment.saving')}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => {
    const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: isDesktop ? 'center' : 'flex-end',
            padding: isDesktop ? 20 : 0,
        },
        container: {
            backgroundColor: theme.background.surface,
            ...(isDesktop ? {
                borderRadius: 20,
                width: '100%',
                maxWidth: 500,
                alignSelf: 'center',
                maxHeight: '85%',
                overflow: 'hidden',
                marginTop: 40,
            } : {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                height: '85%',
                width: '100%',
            }),
            ...Platform.select({
                android: { elevation: 20 },
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10 },
                web: { boxShadow: '0px 8px 32px rgba(0,0,0,0.2)' }
            }),
        },
        handleContainer: {
            alignItems: 'center',
            paddingVertical: 12,
            display: isDesktop ? 'none' : 'flex',
        },
        handle: {
            width: 40,
            height: 4,
            backgroundColor: theme.border.default,
            borderRadius: 2,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            marginBottom: 20,
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: theme.text.primary,
            letterSpacing: -0.5,
        },
        closeButton: {
            padding: 6,
            backgroundColor: theme.background.subtle,
            borderRadius: 20,
        },
        formSection: {
            paddingHorizontal: 20,
        },
        sectionLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.text.tertiary,
            marginBottom: 10,
            letterSpacing: 1,
        },
        input: {
            fontSize: 16,
            color: theme.text.primary,
        },
        titleInputContainer: {
            backgroundColor: theme.background.subtle,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border.default,
            paddingHorizontal: 12,
        },
        chipsContainer: {
            gap: 10,
            paddingRight: 20,
        },
        chip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: theme.border.default,
        },
        activeChip: {
            backgroundColor: theme.components.button.primary.bg,
            borderColor: theme.components.button.primary.bg,
            ...Platform.select({
                ios: { shadowColor: theme.components.button.primary.bg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
                android: { elevation: 4 }
            }),
        },
        chipText: {
            fontSize: 14,
            color: theme.text.secondary,
            fontWeight: '600',
        },
        activeChipText: {
            color: 'white',
            fontWeight: '700',
        },
        generalOption: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background.subtle,
            marginHorizontal: 20,
            padding: 16,
            borderRadius: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border.subtle,
        },
        iconContainer: {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        generalOptionText: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.text.primary,
        },
        generalOptionSub: {
            fontSize: 12,
            color: theme.text.tertiary,
            marginTop: 2,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background.subtle,
            marginHorizontal: 20,
            paddingHorizontal: 16,
            borderRadius: 16,
            marginBottom: 12,
            height: 52,
            borderWidth: 1,
            borderColor: theme.border.default,
        },
        searchIcon: {
            marginRight: 10,
        },
        searchInput: {
            flex: 1,
            backgroundColor: 'transparent',
            borderWidth: 0,
            fontSize: 16,
            color: theme.text.primary,
        },
        searchInputContainer: {
            backgroundColor: 'transparent',
            borderWidth: 0,
            minHeight: 52,
        },
        listContent: {
            paddingBottom: 40,
        },
        playerItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border.subtle,
        },
        playerName: {
            flex: 1,
            marginLeft: 14,
            fontSize: 16,
            color: theme.text.primary,
            fontWeight: '600',
        },
        emptyContainer: {
            paddingTop: 60,
            alignItems: 'center',
            paddingHorizontal: 40,
        },
        emptyText: {
            textAlign: 'center',
            color: theme.text.tertiary,
            fontSize: 16,
            fontWeight: '500',
        },
        helperText: {
            textAlign: 'center',
            color: theme.text.tertiary,
            fontSize: 14,
            fontStyle: 'italic',
            opacity: 0.8,
        },
        modalLoadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        },
        modalLoadingText: {
            color: 'white',
            marginTop: 16,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: 0.5,
        }
    });
};
