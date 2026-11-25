import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { restoreSession } from '../src/auth/session';
import { useAuthStore } from '../src/auth/store';
import { onCallEvent, connectCallSocket, disconnectCallSocket } from '../src/calls/socket';
import { useCallStore } from '../src/calls/store';
import { callsApi, type CallDto, type CallJoinResponse } from '../src/calls/api';
import { onCallConnect } from '../src/calls/socket';
import '../src/livekit/setup';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    const syncSocket = (token: string | null) => {
      if (token) connectCallSocket();
      else disconnectCallSocket();
    };
    syncSocket(useAuthStore.getState().accessToken);
    const unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
      if (state.accessToken !== previous.accessToken) syncSocket(state.accessToken);
    });

    const unlistenIncoming = onCallEvent<{ call: CallDto }>('call:incoming', ({ call }) => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser || call.calleeId !== currentUser.id) return;
      useCallStore.getState().setLastOutcome(null);
      useCallStore.getState().setIncomingCall(call);
      router.push('/incoming-call' as never);
    });
    let recovering = false;
    const recoverActiveCall = async () => {
      if (recovering || !useAuthStore.getState().accessToken) return;
      recovering = true;
      try {
        const { call } = await callsApi.active();
        const user = useAuthStore.getState().user;
        if (!call || !user) return;
        const store = useCallStore.getState();
        if (call.status === 'RINGING' && call.calleeId === user.id) {
          if (store.incomingCall?.id === call.id || store.session?.callId === call.id) return;
          store.setLastOutcome(null);
          store.setIncomingCall(call);
          router.push('/incoming-call' as never);
        } else if (call.status === 'RINGING' && call.callerId === user.id) {
          if (store.outgoingCall?.id === call.id || store.session?.callId === call.id) return;
          store.setOutgoingCall(call);
          router.push('/outgoing-call' as never);
        } else if (call.status === 'ACCEPTED' && store.session?.callId !== call.id) {
          const joined = await callsApi.join(call.id);
          store.setIncomingCall(null);
          store.setOutgoingCall(null);
          store.setSession({
            callId: joined.call.id,
            roomName: joined.call.roomName,
            type: joined.call.type,
            url: joined.livekit.url,
            token: joined.livekit.token,
          });
          router.replace('/call-room');
        }
      } catch {
        // Socket reconnect and call state can complete independently. A future
        // reconnect performs the same authorized recovery query.
      } finally {
        recovering = false;
      }
    };
    const unlistenConnect = onCallConnect(() => void recoverActiveCall());
    const unlistenAccepted = onCallEvent<CallJoinResponse>('call:accepted', (session) => {
      const active = useCallStore.getState().outgoingCall;
      if (!active || active.id !== session.call.id) return;
      useCallStore.getState().setOutgoingCall(null);
      useCallStore.getState().setSession({
        callId: session.call.id,
        roomName: session.call.roomName,
        type: session.call.type,
        url: session.livekit.url,
        token: session.livekit.token,
      });
      router.replace('/call-room');
    });
    const finishCall = (call: CallDto) => {
      const state = useCallStore.getState();
      if (
        state.session?.callId !== call.id &&
        state.outgoingCall?.id !== call.id &&
        state.incomingCall?.id !== call.id
      )
        return;
      state.setLastOutcome(call.status);
      state.clearSession();
      router.replace('/calls');
    };
    const unlistenRejected = onCallEvent<{ call: CallDto }>('call:rejected', ({ call }) =>
      finishCall(call),
    );
    const unlistenMissed = onCallEvent<{ call: CallDto }>('call:missed', ({ call }) =>
      finishCall(call),
    );
    const unlistenEnded = onCallEvent<{ call: CallDto }>('call:ended', ({ call }) =>
      finishCall(call),
    );

    return () => {
      unsubscribeAuth();
      unlistenIncoming();
      unlistenConnect();
      unlistenAccepted();
      unlistenRejected();
      unlistenMissed();
      unlistenEnded();
      disconnectCallSocket();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
        }}
      />
    </QueryClientProvider>
  );
}
