import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { FormField } from '../src/components/FormField';
import { InlineError } from '../src/components/InlineError';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useAuthStore } from '../src/auth/store';
import { apiErrorMessage } from '../src/api/error-message';
import type { CallDto, CallType } from '../src/calls/api';
import { emitCallEvent } from '../src/calls/socket';
import { useCallStore } from '../src/calls/store';
import { theme } from '../src/theme';

export default function CallsScreen() {
  const user = useAuthStore((state) => state.user);
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);
  const lastOutcome = useCallStore((state) => state.lastOutcome);
  const clearOutcome = useCallStore((state) => state.setLastOutcome);
  const [calleeId, setCalleeId] = useState('');
  const [callType, setCallType] = useState<CallType>('VIDEO');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!user) return <Redirect href="/login" />;

  const startCall = async () => {
    setPending(true);
    setError(null);
    clearOutcome(null);
    try {
      const result = await emitCallEvent<{ call: CallDto }>('call:invite', {
        calleeId: calleeId.trim(),
        type: callType,
      });
      setOutgoingCall(result.call);
      router.push('/outgoing-call' as never);
    } catch (cause) {
      setError(cause);
    } finally {
      setPending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.brand} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText style={styles.eyebrow}>LANDCONNECT VOICE</AppText>
          <AppText style={styles.title}>Private calls</AppText>
          <AppText style={styles.subtitle}>Connect directly without sharing phone numbers.</AppText>
        </View>
      </View>

      {lastOutcome ? (
        <View style={styles.outcome}>
          <Ionicons name="information-circle-outline" size={19} color={theme.colors.brand} />
          <AppText style={styles.outcomeText}>
            {lastOutcome === 'REJECTED'
              ? 'The call was declined.'
              : lastOutcome === 'MISSED'
                ? 'The call was not answered.'
                : 'The call has ended.'}
          </AppText>
        </View>
      ) : null}

      <View style={styles.identityCard}>
        <View style={styles.identityIcon}>
          <Ionicons name="finger-print-outline" size={18} color={theme.colors.brand} />
        </View>
        <View style={styles.identityCopy}>
          <AppText style={styles.identityTitle}>Your test user ID</AppText>
          <AppText selectable style={styles.identityValue}>
            {user.id}
          </AppText>
        </View>
        <AppText style={styles.copyHint}>SELECT TO COPY</AppText>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.headingIcon}>
            <Ionicons name="call-outline" size={20} color={theme.colors.brand} />
          </View>
          <View style={styles.sectionCopy}>
            <AppText style={styles.sectionTitle}>Call a LandConnect user</AppText>
            <AppText style={styles.sectionSubtitle}>They will see an incoming call screen.</AppText>
          </View>
        </View>
        <FormField
          label="Their user ID"
          value={calleeId}
          onChangeText={setCalleeId}
          placeholder="Paste their user ID"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={36}
        />
        <AppText style={styles.fieldLabel}>CALL TYPE</AppText>
        <View style={styles.callTypes}>
          <CallTypeOption
            type="AUDIO"
            selected={callType === 'AUDIO'}
            onPress={() => setCallType('AUDIO')}
          />
          <CallTypeOption
            type="VIDEO"
            selected={callType === 'VIDEO'}
            onPress={() => setCallType('VIDEO')}
          />
        </View>
        <PrimaryButton
          title="Start private call"
          loading={pending}
          disabled={!calleeId.trim()}
          onPress={() => void startCall()}
        />
        <InlineError message={error ? apiErrorMessage(error) : null} />
        <AppText style={styles.privacyNote}>
          Only the invited account can accept. Your phone number stays private.
        </AppText>
      </View>
    </ScrollView>
  );
}

function CallTypeOption({
  type,
  selected,
  onPress,
}: {
  type: CallType;
  selected: boolean;
  onPress: () => void;
}) {
  const video = type === 'VIDEO';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.callType, selected && styles.callTypeSelected]}
    >
      <Ionicons
        name={video ? 'videocam-outline' : 'mic-outline'}
        size={19}
        color={selected ? theme.colors.white : theme.colors.brand}
      />
      <AppText style={[styles.callTypeText, selected && styles.callTypeTextSelected]}>
        {video ? 'Video' : 'Audio'}
      </AppText>
      {selected ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: theme.colors.background, padding: 20, paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: theme.colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 4,
  },
  subtitle: { color: theme.colors.muted, fontSize: 14, marginTop: 4 },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EAF1E8',
    marginBottom: 14,
  },
  outcomeText: { color: theme.colors.brand, fontSize: 13, fontWeight: '700' },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBE5D7',
    borderRadius: 17,
    backgroundColor: '#EFF4EA',
    marginBottom: 18,
  },
  identityIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: { flex: 1, gap: 3 },
  identityTitle: { color: theme.colors.brand, fontSize: 12, fontWeight: '800' },
  identityValue: { color: theme.colors.muted, fontSize: 10, fontFamily: 'monospace' },
  copyHint: { color: theme.colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 21,
    shadowColor: '#294333',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: theme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: theme.colors.muted, fontSize: 12 },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  callTypes: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  callType: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    backgroundColor: theme.colors.input,
  },
  callTypeSelected: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  callTypeText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  callTypeTextSelected: { color: theme.colors.white },
  privacyNote: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
});
