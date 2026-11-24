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
import { TextLink } from '../src/components/TextLink';
import { authApi } from '../src/auth/api';
import { persistSession } from '../src/auth/session';
import { useAuthStore } from '../src/auth/store';
import { apiErrorMessage } from '../src/api/error-message';
import { theme } from '../src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const login = useMutation({
    mutationFn: async () => {
      const session = await authApi.login({ email: email.trim(), password });
      await persistSession(session);
      return session;
    },
    onSuccess: () => router.replace('/home'),
  });

  const submit = () => {
    if (!email.trim() || !password) {
      login.reset();
      return;
    }
    login.mutate();
  };

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to continue to your land conversations."
      footer={
        <View style={styles.footerRow}>
          <AppText style={styles.footerText}>New to LandConnect?</AppText>
          <TextLink label="Create account" onPress={() => router.push('/register')} />
        </View>
      }
    >
      <InlineError message={login.error ? apiErrorMessage(login.error) : bootstrapError} />
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
        returnKeyType="next"
      />
      <FormField
        label="Password"
        leading={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.muted} />}
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <PrimaryButton
        title="Sign in"
        loading={login.isPending}
        disabled={!email.trim() || !password}
        onPress={submit}
      />
      <AppText style={styles.privacy}>
        Your email and phone are never shown on public listings.
      </AppText>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: theme.colors.muted, fontSize: 14 },
  privacy: {
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
  },
});
