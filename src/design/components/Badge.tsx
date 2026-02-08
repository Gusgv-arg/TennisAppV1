import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
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
        return { bg: theme.components.badge.primary, text: theme.border.active }; // reusing primary active color
      default:
        return { bg: theme.components.badge.default, text: theme.text.secondary };
    }
  };

  const { bg, text } = getVariantStyles();

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
