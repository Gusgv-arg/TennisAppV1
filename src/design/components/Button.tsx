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
import { colors } from '../tokens/colors';
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
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary': return { backgroundColor: colors.primary[500] };
      case 'secondary': return { backgroundColor: colors.secondary[500] };
      case 'warning': return { backgroundColor: colors.warning[500] };
      case 'danger': return { backgroundColor: colors.error[500] };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary[500] };
      case 'ghost': return { backgroundColor: 'transparent' };
      default: return { backgroundColor: colors.primary[500] };
    }
  };

  const getLabelStyle = (): TextStyle => {
    switch (variant) {
      case 'outline':
      case 'ghost': return { color: colors.primary[500] };
      default: return { color: colors.common.white };
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm': return { paddingVertical: spacing.xs, paddingHorizontal: spacing.md };
      case 'lg': return { paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
      default: return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      {...props}
      onPress={(e) => {
        console.log('Button pressed:', label);
        if (props.onPress) {
          props.onPress(e);
        } else {
          console.warn('Button pressed but no onPress handler provided for:', label);
        }
      }}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        shadow && styles.shadow,
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
              styles.text,
              getLabelStyle(),
              { fontSize: typography.size[size === 'sm' ? 'sm' : 'md'] },
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
