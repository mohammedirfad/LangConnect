import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { AuthFrame } from '../src/components/AuthFrame';
import { FormField } from '../src/components/FormField';
import { InlineError } from '../src/components/InlineError';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { RoleSelector } from '../src/components/RoleSelector';
import { TextLink } from '../src/components/TextLink';
import { authApi } from '../src/auth/api';
import { persistSession } from '../src/auth/session';
import { apiErrorMessage } from '../src/api/error-message';
import type { UserRole } from '../src/auth/types';
import { theme } from '../src/theme';

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('BUYER');
  const [formError, setFormError] = useState<string | null>(null);
  const register = useMutation({
    mutationFn: async () => {
      const session = await authApi.register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        role,
      });
      await persistSession(session);
      return session;
    },
    onSuccess: () => router.replace('/home'),
  });

  const submit = () => {
    setFormError(null);
    if (displayName.trim().length < 2) {
      setFormError('Enter a name with at least 2 characters.');
      return;
    }
    if (password.length < 12) {
      setFormError('Use a password with at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('The passwords do not match.');
      return;
    }
    if (!email.trim()) {
      setFormError('Enter your email address.');
      return;
    }
    register.mutate();
  };

  return (
    <AuthFrame
      title="Create account"
      subtitle="Join buyers, sellers and brokers finding the right land."
      footer={
        <View style={styles.footerRow}>
          <AppText style={styles.footerText}>Already have an account?</AppText>
          <TextLink label="Sign in" onPress={() => router.replace('/login')} />
        </View>
      }
    >
      <InlineError
        message={formError ?? (register.error ? apiErrorMessage(register.error) : null)}
      />
      <FormField
        label="Your name"
        leading={<Ionicons name="person-outline" size={18} color={theme.colors.muted} />}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Full name"
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        maxLength={80}
      />
      <FormField
        label="Email address"
        leading={<Ionicons name="mail-outline" size={18} color={theme.colors.muted} />}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        maxLength={254}
      />
      <RoleSelector value={role} onChange={setRole} />
      <FormField
        label="Password"
        leading={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.muted} />}
        value={password}
        onChangeText={setPassword}
        placeholder="At least 12 characters"
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        maxLength={128}
      />
      <FormField
        label="Confirm password"
        leading={<Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.muted} />}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Enter your password again"
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        onSubmitEditing={submit}
        maxLength={128}
      />
      <PrimaryButton title="Create account" loading={register.isPending} onPress={submit} />
      <AppText style={styles.privacy}>Your contact details stay private.</AppText>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: theme.colors.muted, fontSize: 14 },
  privacy: { color: theme.colors.muted, fontSize: 12, textAlign: 'center', marginTop: 15 },
});
