import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../src/components/AppText';
import { InlineError } from '../src/components/InlineError';
import { useCallStore } from '../src/calls/store';
import { emitCallEvent } from '../src/calls/socket';
import type { CallDto, CallJoinResponse } from '../src/calls/api';

export default function IncomingCallScreen() {
  const call = useCallStore((state) => state.incomingCall);
  const setIncomingCall = useCallStore((state) => state.setIncomingCall);
  const setSession = useCallStore((state) => state.setSession);
  const [pending, setPending] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!call) return <Redirect href="/calls" />;

  const act = async (action: 'accept' | 'reject') => {
    setPending(action);
    setError(null);
    try {
      if (action === 'accept') {
        const result = await emitCallEvent<CallJoinResponse>('call:accept', { callId: call.id });
        setIncomingCall(null);
        setSession({
          callId: result.call.id,
          roomName: result.call.roomName,
          type: result.call.type,
          url: result.livekit.url,
          token: result.livekit.token,
        });
        router.replace('/call-room');
      } else {
        await emitCallEvent<{ call: CallDto }>('call:reject', { callId: call.id });
        setIncomingCall(null);
        router.replace('/calls');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The call could not be answered.');
    } finally {
      setPending(null);
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
        <AppText style={styles.title}>Incoming {isVideo ? 'video' : 'audio'} call</AppText>
        <AppText style={styles.subtitle}>LandConnect user</AppText>
        <AppText selectable style={styles.userId}>
          {call.callerId}
        </AppText>
      </View>
      <InlineError message={error} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(pending)}
          onPress={() => void act('reject')}
          style={[styles.action, styles.decline]}
        >
          <Ionicons name="call" size={25} color="#FFFFFF" style={styles.declineIcon} />
          <AppText style={styles.actionLabel}>
            {pending === 'reject' ? 'Declining…' : 'Decline'}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(pending)}
          onPress={() => void act('accept')}
          style={[styles.action, styles.accept]}
        >
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={25} color="#FFFFFF" />
          <AppText style={styles.actionLabel}>
            {pending === 'accept' ? 'Joining…' : 'Accept'}
          </AppText>
        </Pressable>
      </View>
      <AppText style={styles.privacy}>Your phone number is not shared.</AppText>
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
  actions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 24,
  },
  action: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  decline: { backgroundColor: '#C7473D' },
  accept: { backgroundColor: '#27854F' },
  declineIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  privacy: { color: '#A8B7AA', fontSize: 11, marginBottom: 12 },
});
