import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';

interface AvatarProps {
  source?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const SIZES = {
  sm: 32,
  md: 48,
  lg: 64,
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
  style,
}) => {
  const dimension = SIZES[size];
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View
      style={[
        styles.container,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        style,
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, { borderRadius: dimension / 2 }]}
        />
      ) : (
        <View style={[styles.fallback, { borderRadius: dimension / 2 }]}>
          <Text
            style={[
              styles.initials,
              { fontSize: dimension / (size === 'sm' ? 2 : 2.5) },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[200],
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
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: colors.primary[700],
    fontWeight: '700',
  },
});
