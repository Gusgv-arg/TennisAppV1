import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface VideoAssignmentModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectPlayer: (playerId: string | null) => void;
    isUploading?: boolean;
}

export default function VideoAssignmentModal({ visible, onClose, onSelectPlayer, isUploading }: VideoAssignmentModalProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [searchQuery, setSearchQuery] = useState('');
    const { data: players } = usePlayers(searchQuery, 'active'); // Fetch active players

    // Filter logic if needed client side, but usePlayers handles search usually
    // We'll trust usePlayers or add client filter if needed.
    // Assuming usePlayers(searchQuery) handles it.

    const handleSelect = (playerId: string | null) => {
        onSelectPlayer(playerId);
        // Modal stays open or closes depending on parent logic (parent likely closes it or shows upload progress)
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Guardar Video</Text>
                        <TouchableOpacity onPress={onClose} disabled={isUploading}>
                            <Ionicons name="close" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Asigna este video a un alumno o guárdalo como general.</Text>

                    <View style={styles.searchContainer}>
                        <Input
                            placeholder="Buscar alumno..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            leftIcon={<Ionicons name="search" size={20} color={theme.text.secondary} />}
                        />
                    </View>

                    <Button
                        label="Guardar como General"
                        variant="ghost"
                        onPress={() => handleSelect(null)}
                        style={styles.generalButton}
                        disabled={isUploading}
                    />

                    <FlatList
                        data={players}
                        keyExtractor={(item) => item.id}
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
                        style={styles.list}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No se encontraron alumnos</Text>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: theme.background.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: '80%', // Bottom sheet style
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text.primary,
    },
    subtitle: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 20,
    },
    searchContainer: {
        marginBottom: 15,
    },
    generalButton: {
        marginBottom: 15,
        borderColor: theme.border.default,
        borderWidth: 1,
    },
    list: {
        flex: 1,
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    playerName: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: theme.text.primary,
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        color: theme.text.secondary,
        marginTop: 20,
    },
});
