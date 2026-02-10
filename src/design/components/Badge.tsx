import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}) => {
  const { theme } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.components.badge.success, text: theme.status.success };
      case 'warning':
        return { bg: theme.components.badge.warning, text: theme.status.warning };
      case 'error':
        return { bg: theme.components.badge.error, text: theme.status.error };
      case 'primary':
        return { bg: theme.components.badge.primary, text: theme.border.active };
      default:
        return { bg: theme.components.badge.default, text: theme.text.secondary };
    }
  };

  const { bg, text } = getVariantStyles();

  const sizeStyles = size === 'sm' ? styles.small : styles.medium;

  return (
    <View style={[styles.container, sizeStyles, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, size === 'sm' && styles.smallText, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  small: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 0,
  },
  text: {
    ...typography.variants.labelSmall,
  },
  smallText: {
    fontSize: 10,
    lineHeight: 14,
  },
});
