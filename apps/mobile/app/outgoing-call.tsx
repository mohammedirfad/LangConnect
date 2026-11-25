import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { InlineError } from '../src/components/InlineError';
import type { CallDto } from '../src/calls/api';
import { emitCallEvent } from '../src/calls/socket';
import { useCallStore } from '../src/calls/store';

export default function OutgoingCallScreen() {
  const call = useCallStore((state) => state.outgoingCall);
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);
  const setLastOutcome = useCallStore((state) => state.setLastOutcome);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!call) return <Redirect href="/calls" />;

  const cancel = async () => {
    setPending(true);
    setError(null);
    try {
      await emitCallEvent<{ call: CallDto }>('call:end', { callId: call.id });
      setLastOutcome('ENDED');
      setOutgoingCall(null);
      router.replace('/calls');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel the call.');
    } finally {
      setPending(false);
    }
  };

  const isVideo = call.type === 'VIDEO';
  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <AppText style={styles.brand}>LANDCONNECT</AppText>
        <View style={styles.avatar}>
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={38} color="#F4F7EF" />
        </View>
        <AppText style={styles.title}>Calling…</AppText>
        <AppText style={styles.subtitle}>{isVideo ? 'Video call' : 'Audio call'}</AppText>
        <AppText selectable style={styles.userId}>
          {call.calleeId}
        </AppText>
        <AppText style={styles.ringing}>Waiting for them to answer</AppText>
      </View>
      <InlineError message={error} />
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={() => void cancel()}
        style={styles.cancel}
      >
        <Ionicons name="call" size={23} color="#FFFFFF" style={styles.cancelIcon} />
        <AppText style={styles.cancelLabel}>{pending ? 'Ending…' : 'Cancel call'}</AppText>
      </Pressable>
      <AppText style={styles.privacy}>The call ends automatically if there is no answer.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14271E',
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: {
    color: '#C7D8C5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 48,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#355642',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#C3D0C1', fontSize: 15, marginTop: 12 },
  userId: { color: '#9EAF9E', fontSize: 11, marginTop: 6 },
  ringing: { color: '#F0DBA4', fontSize: 13, fontWeight: '600', marginTop: 25 },
  cancel: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C7473D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 19,
  },
  cancelIcon: { transform: [{ rotate: '135deg' }] },
  cancelLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  privacy: { color: '#A8B7AA', fontSize: 11, marginBottom: 12 },
});
