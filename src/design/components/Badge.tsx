import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../tokens/colors';
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
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: '#DCFCE7', text: '#166534' };
      case 'warning':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'error':
        return { bg: '#FEE2E2', text: '#991B1B' };
      case 'primary':
        return { bg: colors.primary[100], text: colors.primary[700] };
      default:
        return { bg: colors.neutral[100], text: colors.neutral[700] };
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
