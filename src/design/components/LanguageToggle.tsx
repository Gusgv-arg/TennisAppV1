import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export const LanguageToggle: React.FC = () => {
    const { i18n } = useTranslation();
    const { theme } = useTheme();
    
    // 0 for EN, 1 for ES
    const slideAnim = useRef(new Animated.Value(i18n.language.startsWith('es') ? 1 : 0)).current;

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('es') ? 'en' : 'es';
        i18n.changeLanguage(newLang);
    };

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: i18n.language.startsWith('es') ? 1 : 0,
            useNativeDriver: false, // background color and transform translateX on some platforms
            friction: 8,
            tension: 45
        }).start();
    }, [i18n.language]);

    const translateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 38] // Slider width is 36, container padding is 2. (76 - 36 - 2 - 2 = 36)
    });

    const enTextColor = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.components.button.primary.text, theme.text.primary]
    });

    const esTextColor = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: theme.mode === 'dark' ? [theme.text.primary, '#000'] : [theme.text.primary, theme.components.button.primary.text]
    });

    return (
        <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={toggleLanguage} 
            style={[styles.container, { backgroundColor: theme.background.neutral || theme.background.subtle }]}
        >
            <Animated.View 
                style={[
                    styles.slider, 
                    { 
                        backgroundColor: theme.components.button.primary.bg,
                        transform: [{ translateX }]
                    }
                ]} 
            />
            <View style={styles.content}>
                <View style={styles.option}>
                    <Animated.Text style={[styles.text, { color: enTextColor }]}>EN</Animated.Text>
                </View>
                <View style={styles.option}>
                    <Animated.Text style={[styles.text, { color: esTextColor }]}>ES</Animated.Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 76,
        height: 32,
        borderRadius: 16,
        padding: 2,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        ...(Platform.OS === 'web' ? {
            cursor: 'pointer',
            userSelect: 'none',
        } : {}) as any
    },
    slider: {
        position: 'absolute',
        width: 36,
        height: 28,
        borderRadius: 14,
        top: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        zIndex: 1,
    },
    option: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 12,
        fontWeight: '800',
    }
});
