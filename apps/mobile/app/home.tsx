import { Redirect, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { BrandMark } from '../src/components/BrandMark';
import { InlineError } from '../src/components/InlineError';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { revokeAndClearSession } from '../src/auth/session';
import { useAuthStore } from '../src/auth/store';
import { apiErrorMessage } from '../src/api/error-message';
import { theme } from '../src/theme';

const roleLabels = { BUYER: 'Buyer', SELLER: 'Seller', BROKER: 'Broker' } as const;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const logout = useMutation({
    mutationFn: revokeAndClearSession,
    onSuccess: () => router.replace('/login'),
  });

  if (isHydrating) {
    return <ActivityIndicator style={styles.loading} size="large" color={theme.colors.brand} />;
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BrandMark size={42} />
        <AppText style={styles.brand}>LandConnect</AppText>
      </View>
      <View style={styles.card}>
        <AppText style={styles.eyebrow}>YOUR ACCOUNT</AppText>
        <AppText style={styles.greeting}>Welcome, {user.displayName}</AppText>
        <AppText style={styles.email}>{user.email}</AppText>
        <View style={styles.roleBadge}>
          <AppText style={styles.roleText}>{roleLabels[user.role]}</AppText>
        </View>
      </View>
      <InlineError message={logout.error ? apiErrorMessage(logout.error) : null} />
      <View style={styles.note}>
        <AppText style={styles.noteTitle}>Your account is ready</AppText>
        <AppText style={styles.noteBody}>
          Marketplace listings and calls will appear here in upcoming setup steps.
        </AppText>
      </View>
      <View style={styles.spacer} />
      <PrimaryButton title="Sign out" loading={logout.isPending} onPress={() => logout.mutate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: 24, paddingTop: 58 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  brand: { color: theme.colors.brand, fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    padding: 22,
  },
  eyebrow: { color: theme.colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  greeting: {
    color: theme.colors.text,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  email: { color: theme.colors.muted, fontSize: 15, marginTop: 5 },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandLight,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginTop: 18,
  },
  roleText: { color: theme.colors.brand, fontSize: 13, fontWeight: '700' },
  note: { padding: 19, marginTop: 18, borderRadius: 19, backgroundColor: theme.colors.brandLight },
  noteTitle: { color: theme.colors.brand, fontSize: 16, fontWeight: '700' },
  noteBody: { color: theme.colors.text, fontSize: 14, lineHeight: 20, marginTop: 5 },
  spacer: { flex: 1 },
});
