import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { shadows } from '../tokens/shadows';
import { spacing } from '../tokens/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'md',
  elevation = 'sm',
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background.surface,
          padding: spacing[padding],
          // In dark mode, shadows are invisible, so we use a subtle border
          borderWidth: isDark ? 1 : 0,
          borderColor: theme.border.subtle,
        },
        // Only apply shadow if not dark mode (or use specific dark mode shadows if available)
        !isDark && shadows[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
});
