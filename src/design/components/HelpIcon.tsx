import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

interface HelpIconProps {
    onPress: () => void;
    size?: number;
    style?: ViewStyle;
}

export const HelpIcon: React.FC<HelpIconProps> = ({ onPress, size = 20, style }) => {
    const circleSize = size * 1.5;
    
    return (
        <TouchableOpacity 
            onPress={onPress} 
            style={[
                styles.container, 
                { 
                    width: circleSize, 
                    height: circleSize, 
                    borderRadius: circleSize / 2 
                }, 
                style
            ]}
            activeOpacity={0.7}
        >
            <Ionicons name="help" size={size} color="#000" />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#CCFF00', // Lime green from video section
        justifyContent: 'center',
        alignItems: 'center',
    },
});
