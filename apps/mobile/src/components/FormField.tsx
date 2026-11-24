import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  trailing?: ReactNode;
  leading?: ReactNode;
}

export function FormField({
  label,
  trailing,
  leading,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {trailing}
      </View>
      <View style={[styles.inputShell, focused && styles.inputFocused]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, style]}
          placeholderTextColor="#929B91"
          selectionColor={theme.colors.brand}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 15 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: { color: theme.colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.input,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  leading: { marginRight: 11 },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 0,
    fontFamily: theme.fonts.family,
    color: theme.colors.text,
    fontSize: 16,
  },
});
