import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import { Theme } from '../design/theme';
import { useTheme } from '../hooks/useTheme';

export const toastConfig = {
    success: (props: BaseToastProps) => <CustomToast {...props} type="success" />,
    error: (props: BaseToastProps) => <CustomToast {...props} type="error" />,
    info: (props: BaseToastProps) => <CustomToast {...props} type="info" />,
};

interface CustomToastProps extends BaseToastProps {
    type: 'success' | 'error' | 'info';
}

const CustomToast: React.FC<CustomToastProps> = ({ text1, text2, type }) => {
    const { theme } = useTheme();
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const styles = getStyles(theme, type, isDesktop);

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'error': return 'alert-circle'; // or close-circle
            case 'info': return 'information-circle';
            default: return 'help-circle';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success': return theme.status.success;
            case 'error': return theme.status.error;
            case 'info': return theme.components.button.primary.bg; // Info blue
            default: return theme.text.primary;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.accentStrip} />
            <View style={styles.contentContainer}>
                <View style={styles.iconContainer}>
                    <Ionicons name={getIcon()} size={isDesktop ? 24 : 28} color={getIconColor()} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>{text1}</Text>
                    {text2 && <Text style={styles.subtitle} numberOfLines={2}>{text2}</Text>}
                </View>
            </View>
        </View>
    );
};

const getStyles = (theme: Theme, type: 'success' | 'error' | 'info', isDesktop: boolean) => {
    let accentColor;
    switch (type) {
        case 'success': accentColor = theme.status.success; break;
        case 'error': accentColor = theme.status.error; break;
        case 'info': accentColor = theme.components.button.primary.bg; break;
    }

    return StyleSheet.create({
        container: {
            height: isDesktop ? 60 : 80, // Taller for better readability on mobile, compact on desktop
            width: isDesktop ? 400 : '90%', // Fixed width for desktop, percentage for mobile
            maxWidth: isDesktop ? '100%' : 400, // Cap mobile width too
            backgroundColor: theme.background.surface,
            borderRadius: isDesktop ? 8 : 12, // Slightly tighter radius on desktop
            flexDirection: 'row',
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: isDesktop ? 2 : 4,
            },
            shadowOpacity: isDesktop ? 0.1 : 0.15, // Softer shadow on desktop
            shadowRadius: isDesktop ? 8 : 12,
            elevation: isDesktop ? 4 : 8,
            overflow: 'hidden', // Contain the strip
            borderWidth: 1,
            borderColor: theme.border.subtle,
            marginTop: isDesktop ? 20 : 0, // Add top margin for desktop placement
            alignSelf: 'center', // Ensure it centers if container allows
        },
        accentStrip: {
            width: isDesktop ? 4 : 6,
            backgroundColor: accentColor,
            height: '100%',
        },
        contentContainer: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: isDesktop ? 12 : 16,
        },
        iconContainer: {
            marginRight: isDesktop ? 10 : 12,
        },
        textContainer: {
            flex: 1,
            justifyContent: 'center',
        },
        title: {
            fontSize: isDesktop ? 14 : 16,
            fontWeight: '600', // Slightly less bold on desktop
            color: theme.text.primary,
            marginBottom: isDesktop ? 0 : 2,
        },
        subtitle: {
            fontSize: isDesktop ? 12 : 13,
            fontWeight: '400', // Lighter weight for subtitle
            color: theme.text.secondary,
            lineHeight: isDesktop ? 16 : 18,
            marginTop: isDesktop ? 2 : 0,
        },
    });
};
