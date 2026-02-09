import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

interface SelectOption {
    label: string;
    value: string;
}

interface ProSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    error?: string;
    leftIcon?: React.ReactNode;
    placeholder?: string;
    searchable?: boolean;
}

export const ProSelect: React.FC<ProSelectProps> = ({
    label,
    value,
    onChange,
    options,
    error,
    leftIcon,
    placeholder = 'Seleccionar...',
    searchable = true,
}) => {
    const { theme, isDark } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { width, height } = useWindowDimensions();
    const isDesktop = width >= 768;

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const lowerQuery = searchQuery.toLowerCase();
        return options.filter((opt) =>
            opt.label.toLowerCase().includes(lowerQuery)
        );
    }, [options, searchQuery]);

    const handleSelect = (val: string) => {
        onChange(val);
        setModalVisible(false);
        setSearchQuery('');
    };

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>}
            <TouchableOpacity
                style={[
                    styles.triggerButton,
                    {
                        backgroundColor: theme.background.input,
                        borderColor: theme.border.default,
                    },
                    error && { borderColor: theme.status.error },
                ]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                <View style={styles.triggerContent}>
                    {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                    <Text
                        style={[
                            styles.valueText,
                            { color: selectedOption ? theme.text.primary : theme.text.tertiary },
                        ]}
                        numberOfLines={1}
                    >
                        {selectedOption ? selectedOption.label : placeholder}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={theme.text.tertiary} />
            </TouchableOpacity>
            {error && <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>}

            <Modal
                visible={modalVisible}
                animationType={isDesktop ? 'fade' : 'slide'}
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[
                    styles.modalOverlay,
                    isDesktop && styles.modalOverlayDesktop,
                    { backgroundColor: theme.background.backdrop }
                ]}>
                    <View style={[
                        styles.modalContent,
                        isDesktop && styles.modalContentDesktop,
                        {
                            backgroundColor: theme.background.modal,
                            height: isDesktop ? 'auto' : height * 0.7,
                            maxHeight: isDesktop ? height * 0.8 : '70%',
                        }
                    ]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border.default }]}>
                            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                                {label || 'Seleccionar'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {searchable && (
                            <View style={[styles.searchContainer, { borderBottomColor: theme.border.default }]}>
                                <Ionicons name="search" size={20} color={theme.text.tertiary} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text.primary }]}
                                    placeholder="Buscar..."
                                    placeholderTextColor={theme.text.tertiary}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus={isDesktop}
                                />
                                {searchQuery !== '' && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color={theme.text.tertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item) => item.value}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        value === item.value && { backgroundColor: theme.components.button.primary.bg + '10' }
                                    ]}
                                    onPress={() => handleSelect(item.value)}
                                >
                                    <Text style={[
                                        styles.optionLabel,
                                        { color: value === item.value ? theme.components.button.primary.bg : theme.text.primary }
                                    ]}>
                                        {item.label}
                                    </Text>
                                    {value === item.value && (
                                        <Ionicons name="checkmark" size={20} color={theme.components.button.primary.bg} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyText, { color: theme.text.tertiary }]}>
                                        No se encontraron opciones
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
        width: '100%',
    },
    label: {
        ...typography.variants.label,
        marginBottom: spacing.xs,
    },
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2, // Consistent with Input
        borderRadius: 10, // Consistent with Input
        paddingHorizontal: spacing.sm,
        minHeight: 48, // Consistent with Input
    },
    triggerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
    },
    iconContainer: {
        marginRight: spacing.xs,
    },
    valueText: {
        ...typography.variants.bodyLarge,
    },
    errorText: {
        ...typography.variants.bodySmall,
        marginTop: spacing.xs,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end', // Default to bottom sheet style
    },
    modalOverlayDesktop: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 500,
        borderRadius: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    modalTitle: {
        ...typography.variants.h3,
    },
    closeButton: {
        padding: spacing.xs,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        ...typography.variants.bodyLarge,
        paddingVertical: spacing.xs,
        outlineStyle: 'none',
    } as any,
    listContent: {
        paddingVertical: spacing.sm,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    optionLabel: {
        ...typography.variants.label,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        ...typography.variants.bodyLarge,
    },
});
