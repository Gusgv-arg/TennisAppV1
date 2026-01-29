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

import { colors } from '../tokens/colors';
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
            {label && <Text style={styles.label}>{label}</Text>}
            <TouchableOpacity
                style={[
                    styles.triggerButton,
                    error && styles.triggerError,
                ]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                <View style={styles.triggerContent}>
                    {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                    <Text
                        style={[
                            styles.valueText,
                            !selectedOption && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                    >
                        {selectedOption ? selectedOption.label : placeholder}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.neutral[500]} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal
                visible={modalVisible}
                animationType={isDesktop ? 'fade' : 'slide'}
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[
                    styles.modalOverlay,
                    isDesktop && styles.modalOverlayDesktop
                ]}>
                    <View style={[
                        styles.modalContent,
                        isDesktop ? styles.modalContentDesktop : styles.modalContentMobile,
                        { maxHeight: isDesktop ? height * 0.8 : '90%' }
                    ]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{label || placeholder}</Text>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={colors.neutral[500]} />
                            </TouchableOpacity>
                        </View>

                        {searchable && (
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar..."
                                    placeholderTextColor={colors.neutral[400]}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus={isDesktop} // Auto focus on desktop usually works better
                                />
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
                                        item.value === value && styles.optionSelected
                                    ]}
                                    onPress={() => handleSelect(item.value)}
                                >
                                    <Text style={[
                                        styles.optionLabel,
                                        item.value === value && styles.optionLabelSelected
                                    ]}>
                                        {item.label}
                                    </Text>
                                    {item.value === value && (
                                        <Ionicons name="checkmark" size={20} color={colors.primary[600]} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>No se encontraron resultados</Text>
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
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2, // Consistent with Input
        borderColor: colors.neutral[200],
        borderRadius: 10, // Consistent with Input
        backgroundColor: colors.common.white,
        paddingHorizontal: spacing.sm,
        minHeight: 48, // Consistent with Input
    },
    triggerError: {
        borderColor: colors.error[500],
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
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    placeholderText: {
        color: colors.neutral[400],
    },
    errorText: {
        fontSize: typography.size.xs,
        color: colors.error[500],
        marginTop: spacing.xs,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Default to bottom sheet style
    },
    modalOverlayDesktop: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: colors.common.white,
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
    },
    modalContentMobile: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 500,
        height: 'auto',
        borderRadius: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
        gap: spacing.sm,
    },
    searchIcon: {
        marginRight: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.size.md,
        color: colors.neutral[900],
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
    optionSelected: {
        backgroundColor: colors.primary[50],
    },
    optionLabel: {
        fontSize: typography.size.md,
        color: colors.neutral[700],
    },
    optionLabelSelected: {
        color: colors.primary[700],
        fontWeight: '600',
    },
    emptyState: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.neutral[500],
        fontSize: typography.size.md,
    },
});
