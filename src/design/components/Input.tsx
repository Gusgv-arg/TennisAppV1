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
import { colors } from '../tokens/colors';
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
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  leftIcon,
  rightIcon,
  onFocus,
  onBlur,
  value,
  ...props
}) => {
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
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.neutral[400]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
          value={normalizedValue}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    backgroundColor: colors.common.white,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: colors.primary[500],
  },
  inputError: {
    borderColor: colors.error[500],
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.neutral[900],
    fontSize: typography.size.md,
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
});
