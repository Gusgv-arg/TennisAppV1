import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'warning' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shadow?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

import { useTheme } from '../../hooks/useTheme';

// ... imports

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  shadow = false,
  leftIcon,
  rightIcon,
  style,
  labelStyle,
  disabled,
  ...props
}) => {
  const { theme, isDark } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary': return { backgroundColor: theme.components.button.primary.bg };
      case 'secondary': return { backgroundColor: theme.components.button.secondary.bg };
      case 'warning': return { backgroundColor: theme.status.warning };
      case 'danger': return { backgroundColor: theme.status.error };
      case 'outline': return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.components.button.outline.border
      };
      case 'ghost': return { backgroundColor: 'transparent' };
      default: return { backgroundColor: theme.components.button.primary.bg };
    }
  };

  const getLabelStyle = (): TextStyle => {
    switch (variant) {
      case 'outline': return { color: theme.components.button.outline.text };
      case 'ghost': return { color: theme.components.button.ghost.text };
      default: return { color: theme.components.button.primary.text }; // Primary and secondary usually white
    }
  };


  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm': return { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 };
      case 'lg': return { paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
      default: return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      {...props}
      onPress={(e) => {
        if (props.onPress) {
          props.onPress(e);
        }
      }}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        shadow && !isDark && styles.shadow,
        disabled && styles.disabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={String(getLabelStyle().color)} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              size === 'sm' ? typography.variants.labelSmall : typography.variants.label,
              getLabelStyle(),
              { marginHorizontal: spacing.xs },
              labelStyle,
            ]}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: { borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '600', marginHorizontal: spacing.xs },
  disabled: { opacity: 0.5 },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
