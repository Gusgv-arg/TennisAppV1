import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { typography } from '../tokens/typography';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  editable?: boolean;
  onPress?: () => void;
  variant?: 'primary' | 'neutral';
}

const SIZES = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
  style,
  editable = false,
  onPress,
  variant = 'primary',
}) => {
  const { theme } = useTheme();
  const dimension = SIZES[size];
  const initials = name
    ? name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : '?';

  const isNeutral = variant === 'neutral';
  
  const backgroundColor = isNeutral 
    ? theme.background.neutral 
    : (theme.mode === 'dark' ? theme.components.tabBar.active : theme.background.neutral);
    
  const textColor = isNeutral
    ? theme.text.primary
    : (theme.mode === 'dark' ? theme.background.surface : theme.text.primary);

  const Content = (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: backgroundColor,
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, { borderRadius: dimension / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              borderRadius: dimension / 2,
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                color: textColor,
                fontSize: dimension / (size === 'xs' ? 1.8 : size === 'sm' ? 2 : 2.5),
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
      {editable && (
        <View style={[styles.editOverlay, !source && { backgroundColor: theme.components.button.primary.bg }]}>
          <Ionicons name="camera" size={dimension / 3} color={theme.text.inverse} />
        </View>
      )}
    </View>
  );

  if (onPress || editable) {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress && !editable} activeOpacity={0.7}>
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: typography.weight.bold,
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
});
