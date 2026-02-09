import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  editable?: boolean;
  onPress?: () => void;
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

  const content = (
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
      ) : !editable ? (
        <View style={[styles.fallback, { borderRadius: dimension / 2 }]}>
          <Text
            style={[
              styles.initials,
              { fontSize: dimension / (size === 'xs' ? 1.8 : size === 'sm' ? 2 : 2.5) },
            ]}
          >
            {initials}
          </Text>
        </View>
      ) : null}
      {editable && (
        <View style={[styles.editOverlay, !source && styles.editOverlaySolid]}>
          <Ionicons name="camera" size={dimension / 3} color={colors.common.white} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
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
    fontWeight: typography.weight.bold,
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
  editOverlaySolid: {
    backgroundColor: colors.primary[400],
  },
});
