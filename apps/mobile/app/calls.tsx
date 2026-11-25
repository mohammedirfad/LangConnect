import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { FormField } from '../src/components/FormField';
import { InlineError } from '../src/components/InlineError';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useAuthStore } from '../src/auth/store';
import { apiErrorMessage } from '../src/api/error-message';
import { callsApi, type CallType } from '../src/calls/api';
import { useCallStore } from '../src/calls/store';
import { theme } from '../src/theme';

type CallMode = 'start' | 'join';

export default function CallsScreen() {
  const user = useAuthStore((state) => state.user);
  const setCallSession = useCallStore((state) => state.setSession);
  const [mode, setMode] = useState<CallMode>('start');
  const [calleeId, setCalleeId] = useState('');
  const [callIdInput, setCallIdInput] = useState('');
  const [createdCallId, setCreatedCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>('VIDEO');
  const createCall = useMutation({
    mutationFn: () => callsApi.create({ calleeId: calleeId.trim(), type: callType }),
    onSuccess: ({ call }) => setCreatedCallId(call.id),
  });
  const status = useQuery({
    queryKey: ['call-status', createdCallId],
    queryFn: () => callsApi.status(createdCallId!),
    enabled: mode === 'start' && Boolean(createdCallId),
    refetchInterval: (query) => (query.state.data?.call.status === 'RINGING' ? 2500 : false),
  });
  const joinCall = useMutation({
    mutationFn: (id: string) => callsApi.join(id.trim()),
    onSuccess: ({ call, livekit }) => {
      setCallSession({
        callId: call.id,
        roomName: call.roomName,
        type: call.type,
        url: livekit.url,
        token: livekit.token,
      });
      router.replace('/call-room');
    },
  });

  if (!user) return <Redirect href="/login" />;

  const accepted = status.data?.call.status === 'ACCEPTED';
  const error = createCall.error ?? joinCall.error ?? (status.isError ? status.error : null);

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

      <View style={styles.modeSwitch}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'start' }}
          onPress={() => setMode('start')}
          style={[styles.mode, mode === 'start' && styles.modeSelected]}
        >
          <AppText style={[styles.modeText, mode === 'start' && styles.modeTextSelected]}>
            Start a call
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'join' }}
          onPress={() => setMode('join')}
          style={[styles.mode, mode === 'join' && styles.modeSelected]}
        >
          <AppText style={[styles.modeText, mode === 'join' && styles.modeTextSelected]}>
            Join by code
          </AppText>
        </Pressable>
      </View>

      <View style={styles.card}>
        {mode === 'start' ? (
          <>
            <View style={styles.sectionHeading}>
              <View style={styles.headingIcon}>
                <Ionicons name="call-outline" size={20} color={theme.colors.brand} />
              </View>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>Invite a person</AppText>
                <AppText style={styles.sectionSubtitle}>
                  Use their test user ID from this screen.
                </AppText>
              </View>
            </View>
            <FormField
              label="Their user ID"
              value={calleeId}
              onChangeText={setCalleeId}
              placeholder="Paste the other user’s ID"
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
              title="Create private call"
              loading={createCall.isPending}
              disabled={!calleeId.trim()}
              onPress={() => createCall.mutate()}
            />
            {createdCallId ? (
              <View style={styles.waitingCard}>
                <View style={styles.waitingHeader}>
                  <View style={[styles.statusDot, accepted && styles.statusDotActive]} />
                  <AppText style={styles.waitingTitle}>
                    {accepted ? 'They accepted' : 'Waiting for them to join'}
                  </AppText>
                  {status.isFetching ? <AppText style={styles.refreshing}>UPDATING</AppText> : null}
                </View>
                <AppText style={styles.waitingHint}>
                  Share this call ID with the other device:
                </AppText>
                <AppText selectable style={styles.callCode}>
                  {createdCallId}
                </AppText>
                <AppText style={styles.waitingHint}>
                  The other person enters it under Join by code. Your room token is issued only
                  after they accept.
                </AppText>
                {accepted ? (
                  <PrimaryButton
                    title="Join call"
                    loading={joinCall.isPending}
                    onPress={() => joinCall.mutate(createdCallId)}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <View style={styles.headingIcon}>
                <Ionicons name="enter-outline" size={20} color={theme.colors.brand} />
              </View>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>Join a call</AppText>
                <AppText style={styles.sectionSubtitle}>
                  Ask the caller to share the call ID.
                </AppText>
              </View>
            </View>
            <FormField
              label="Call ID"
              value={callIdInput}
              onChangeText={setCallIdInput}
              placeholder="Paste the call ID"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={36}
            />
            <AppText style={styles.privacyNote}>
              Only the invited account can accept and receive a LiveKit token.
            </AppText>
            <PrimaryButton
              title="Accept and join"
              loading={joinCall.isPending}
              disabled={!callIdInput.trim()}
              onPress={() => joinCall.mutate(callIdInput)}
            />
          </>
        )}
        <InlineError message={error ? apiErrorMessage(error) : null} />
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
  modeSwitch: {
    flexDirection: 'row',
    gap: 7,
    padding: 5,
    backgroundColor: '#EAEDE4',
    borderRadius: 17,
    marginBottom: 13,
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 43,
    borderRadius: 13,
  },
  modeSelected: {
    backgroundColor: theme.colors.surface,
    shadowColor: '#10271A',
    shadowOpacity: 0.07,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  modeText: { color: theme.colors.muted, fontSize: 13, fontWeight: '700' },
  modeTextSelected: { color: theme.colors.brand },
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
  waitingCard: {
    marginTop: 17,
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#F4F6EF',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  waitingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  statusDotActive: { backgroundColor: '#4A9363' },
  waitingTitle: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  refreshing: { color: theme.colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  waitingHint: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  callCode: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 7,
    letterSpacing: 0.2,
  },
  privacyNote: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 9 },
});
