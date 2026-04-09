import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';

export interface HelpItem {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
}

interface HelpModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    items?: HelpItem[];
    description?: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose, title, items, description }) => {
    const { theme, isDark } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
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
                <View style={[styles.content, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', borderColor: isDark ? '#333' : '#EEE' }]}>
                    <View style={styles.header}>
                        <View style={styles.headerIconWrapper}>
                            <MaterialCommunityIcons name="help" size={22} color="#000" />
                        </View>
                        <Text style={[styles.title, { color: isDark ? '#FFF' : '#333' }]}>{title}</Text>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        {description && (
                            <Text style={[styles.description, { color: isDark ? '#AAA' : '#666' }]}>
                                {description}
                            </Text>
                        )}
                        {items && items.map((item, index) => (
                            <View key={index} style={styles.tipItem}>
                                <View style={styles.iconWrapper}>
                                    <Ionicons name={item.icon} size={22} color="#CCFF00" />
                                </View>
                                <View style={styles.tipTexts}>
                                    <Text style={[styles.tipTitle, { color: isDark ? '#FFF' : '#333' }]}>{item.title}</Text>
                                    <Text style={[styles.tipDescription, { color: isDark ? '#AAA' : '#666' }]}>{item.description}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeBtnText}>Entendido</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        borderRadius: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        padding: 24,
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 8,
    },
    body: {
        marginBottom: 24,
    },
    tipItem: {
        flexDirection: 'row',
        marginBottom: 24,
        gap: 16,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#CCFF00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipTexts: {
        flex: 1,
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    tipDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    closeBtn: {
        backgroundColor: '#CCFF00',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
