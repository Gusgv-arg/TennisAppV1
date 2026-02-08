import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

interface InputProps extends Omit<TextInputProps, 'value'> {
  label?: string;
  error?: string;
  value?: string | null;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'md' | 'sm';
}

import { useTheme } from '../../hooks/useTheme';

// ... imports

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  leftIcon,
  rightIcon,
  size = 'md',
  onFocus,
  onBlur,
  value,
  ...props
}) => {
  const { theme } = useTheme();
  const normalizedValue = value === null ? undefined : value;
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.background.input,
            borderColor: theme.border.default,
          },
          size === 'sm' && styles.inputContainerSm,
          isFocused && {
            borderColor: theme.border.active,
            // Shadows or elevation might need adjustment for dark mode
            ...(!theme.isDark && {
              shadowColor: theme.border.active,
              shadowOpacity: 0.15,
            })
          },
          error && { borderColor: theme.status.error },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, { color: theme.text.primary }, inputStyle]}
          placeholderTextColor={theme.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
          value={normalizedValue}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  inputContainerSm: {
    minHeight: 40,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.size.md,
    paddingVertical: spacing.xs,
    // Eliminar el contorno predeterminado del navegador en web de forma robusta
    outline: 'none',
    outlineWidth: 0,
    outlineStyle: 'none',
    boxShadow: 'none',
  } as any,
  errorText: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
});
