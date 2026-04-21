import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

interface HelpIconProps {
    onPress: () => void;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

export const HelpIcon: React.FC<HelpIconProps> = ({ onPress, size = 18, style }) => {
    const circleSize = size * 1.7; // Making circle larger relative to icon
    
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
            <MaterialCommunityIcons name="help" size={size} color="#000" />
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
