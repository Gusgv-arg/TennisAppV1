import { Avatar } from '@/src/design/components/Avatar';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface VideoAssignmentModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectPlayer: (playerId: string | null, title: string, stroke: string | null) => void;
    isUploading?: boolean;
}

export default function VideoAssignmentModal({ visible, onClose, onSelectPlayer, isUploading }: VideoAssignmentModalProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [searchQuery, setSearchQuery] = useState('');
    const { data: players } = usePlayers(searchQuery, 'active');

    const [title, setTitle] = useState('');
    const [selectedStroke, setSelectedStroke] = useState<string | null>(null);

    const strokes = [
        { id: 'Serve', label: 'Saque' },
        { id: 'Forehand', label: 'Drive' },
        { id: 'Backhand', label: 'Revés' },
        { id: 'Volley', label: 'Volea' },
        { id: 'Smash', label: 'Smash' }
    ];

    React.useEffect(() => {
        if (visible) {
            const date = new Date();
            setTitle(`Video ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            setSelectedStroke(null);
            setSearchQuery('');
        }
    }, [visible]);

    const handleSelect = (playerId: string | null) => {
        onSelectPlayer(playerId, title, selectedStroke);
    };

    const renderHeader = () => (
        <View>
            <View style={styles.handleContainer}>
                <View style={styles.handle} />
            </View>
            <View style={styles.header}>
                <Text style={styles.title}>Guardar Video</Text>
                <TouchableOpacity onPress={onClose} disabled={isUploading} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={theme.text.secondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>TÍTULO</Text>
                <Input
                    placeholder="Escribe un título..."
                    value={title}
                    onChangeText={setTitle}
                    style={styles.input}
                    inputContainerStyle={styles.titleInputContainer}
                    containerStyle={{ marginBottom: 20 }}
                    placeholderTextColor={theme.text.tertiary}
                />

                <Text style={styles.sectionLabel}>TIPO DE GOLPE</Text>
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

            <Text style={[styles.sectionLabel, { marginTop: 10, marginBottom: 10 }]}>ASIGNAR A</Text>

            <TouchableOpacity
                style={styles.generalOption}
                onPress={() => handleSelect(null)}
                disabled={isUploading}
            >
                <View style={[styles.iconContainer, { backgroundColor: theme.status.info }]}>
                    <Ionicons name="folder-open" size={20} color="white" />
                </View>
                <Text style={styles.generalOptionText}>Guardar en General (Sin alumno)</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={theme.text.secondary} style={styles.searchIcon} />
                <Input
                    placeholder="Buscar alumno..."
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
                        ListHeaderComponent={renderHeader()}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.playerItem}
                                onPress={() => handleSelect(item.id)}
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
                                    <Text style={styles.emptyText}>No se encontraron alumnos</Text>
                                ) : (
                                    <Text style={styles.helperText}>Busca un alumno para asignarle el video</Text>
                                )}
                            </View>
                        }
                    />
                    {isUploading && (
                        <View style={styles.modalLoadingOverlay}>
                            <ActivityIndicator size="large" color={theme.text.primary} />
                            <Text style={styles.modalLoadingText}>Guardando video...</Text>
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
                borderRadius: 16,
                width: '100%',
                maxWidth: 500,
                alignSelf: 'center',
                maxHeight: '85%',
                paddingTop: 20,
                paddingBottom: 20,
                marginTop: 40, // Added margin top as requested
            } : {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                height: '70%',
                width: '100%',
                paddingTop: 10,
            }),
            ...Platform.select({
                android: { elevation: 20 },
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10 },
                web: { boxShadow: '0px 4px 24px rgba(0,0,0,0.15)' }
            }),
        },
        handleContainer: {
            alignItems: 'center',
            paddingVertical: 8,
            display: isDesktop ? 'none' : 'flex', // Hide handle on desktop
        },
        handle: {
            width: 36,
            height: 4,
            backgroundColor: theme.border.default,
            borderRadius: 2,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            marginBottom: 15,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.text.primary,
            letterSpacing: -0.5,
        },
        closeButton: {
            padding: 4,
            backgroundColor: theme.background.subtle,
            borderRadius: 20,
        },
        formSection: {
            paddingHorizontal: 20,
        },
        sectionLabel: {
            fontSize: 11,
            fontWeight: '700',
            color: theme.text.tertiary,
            marginBottom: 8,
            letterSpacing: 0.5,
        },
        input: {
            fontSize: 15,
            paddingVertical: 10,
            color: theme.text.primary, // Explicitly set text color
        },
        titleInputContainer: {
            backgroundColor: theme.background.subtle,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border.default,
        },
        chipsContainer: {
            gap: 8,
            paddingRight: 20,
        },
        chip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        activeChip: {
            backgroundColor: theme.components.button.primary.bg,
            elevation: 2,
        },
        chipText: {
            fontSize: 13,
            color: theme.text.secondary,
            fontWeight: '500',
        },
        activeChipText: {
            color: 'white',
            fontWeight: '600',
        },
        generalOption: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background.subtle,
            marginHorizontal: 20,
            padding: 10,
            borderRadius: 12,
            marginBottom: 15,
        },
        iconContainer: {
            width: 28,
            height: 28,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
        },
        generalOptionText: {
            flex: 1,
            fontSize: 15,
            fontWeight: '600',
            color: theme.text.primary,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background.subtle,
            marginHorizontal: 20,
            paddingHorizontal: 12,
            borderRadius: 12,
            marginBottom: 8,
            height: 44,
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            backgroundColor: 'transparent',
            borderWidth: 0,
            height: 44,
            fontSize: 15,
            color: theme.text.primary,
        },
        searchInputContainer: {
            backgroundColor: theme.background.surface, // Distinguish input
            borderWidth: 1,
            borderColor: theme.border.default,
            minHeight: 40,
            paddingHorizontal: 10,
        },
        listContent: {
            paddingBottom: 30,
        },
        playerItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border.subtle,
        },
        playerName: {
            flex: 1,
            marginLeft: 12,
            fontSize: 15,
            color: theme.text.primary,
            fontWeight: '500',
        },
        emptyContainer: {
            paddingTop: 40,
            alignItems: 'center',
        },
        emptyText: {
            textAlign: 'center',
            color: theme.text.tertiary,
            fontSize: 14,
        },
        helperText: {
            textAlign: 'center',
            color: theme.text.tertiary,
            fontSize: 14,
            fontStyle: 'italic',
        },
        modalLoadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 16,
        },
        modalLoadingText: {
            color: 'white',
            marginTop: 10,
            fontSize: 16,
            fontWeight: '600',
        },
    });
};
