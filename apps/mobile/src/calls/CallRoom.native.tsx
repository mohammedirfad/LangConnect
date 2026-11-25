import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  AndroidAudioTypePresets,
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { AppText } from '../components/AppText';
import { InlineError } from '../components/InlineError';
import { callsApi } from './api';
import { emitCallEvent } from './socket';
import { useCallStore } from './store';
import { theme } from '../theme';

export default function CallRoom() {
  const session = useCallStore((state) => state.session);
  const clearSession = useCallStore((state) => state.clearSession);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let started = false;
    void (async () => {
      try {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: 'speaker' },
        });
        await AudioSession.startAudioSession();
        started = true;
        if (active) setAudioReady(true);
        else await AudioSession.stopAudioSession();
      } catch {
        if (active)
          setAudioError(
            'Could not start the call audio session. Check microphone permissions and try again.',
          );
      }
    })();
    return () => {
      active = false;
      if (started) void AudioSession.stopAudioSession();
    };
  }, [session]);

  useEffect(() => {
    if (!session) router.replace('/calls');
  }, [session]);

  const leave = useCallback(async () => {
    if (!session) return;
    try {
      await emitCallEvent('call:end', { callId: session.callId });
    } catch {
      try {
        await callsApi.end(session.callId);
      } catch {
        // Always let the user leave locally if signaling and the API are unavailable.
      }
    } finally {
      clearSession();
      router.replace('/calls');
    }
  }, [clearSession, session]);

  if (!session) {
    return <View style={styles.loadingScreen} />;
  }

  if (audioError) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <View style={styles.errorContent}>
          <Ionicons name="mic-off-outline" size={36} color="#F1C984" />
          <AppText style={styles.errorTitle}>Audio isn’t ready</AppText>
          <InlineError message={audioError} />
          <Pressable onPress={() => void leave()} style={styles.leaveButton}>
            <AppText style={styles.leaveText}>Back to calls</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!audioReady) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#D7B66F" />
        <AppText style={styles.connecting}>Starting secure call…</AppText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect
        audio
        video={session.type === 'VIDEO'}
        options={{ adaptiveStream: true, dynacast: true }}
        onError={() => setAudioError('Call connection failed. Check your internet and try again.')}
        onMediaDeviceFailure={() =>
          setAudioError('Camera or microphone permission was denied. Allow access in Settings.')
        }
      >
        <CallSurface session={session} onEnd={() => void leave()} />
      </LiveKitRoom>
    </View>
  );
}

function CallSurface({
  session,
  onEnd,
}: {
  session: NonNullable<ReturnType<typeof useCallStore.getState>['session']>;
  onEnd: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const cameraTracks = useTracks([Track.Source.Camera]).filter(isTrackReference);
  const remoteTrack = cameraTracks.find((track) => !track.participant.isLocal);
  const localTrack = cameraTracks.find((track) => track.participant.isLocal);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [controlError, setControlError] = useState<string | null>(null);
  const isVideo = session.type === 'VIDEO';
  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return participants.length > 1 ? 'Connected securely' : 'Waiting for the other person';
      case 'reconnecting':
        return 'Reconnecting…';
      case 'connecting':
        return 'Connecting…';
      default:
        return 'Call disconnected';
    }
  }, [connectionState, participants.length]);

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      setControlError(null);
    } catch {
      setControlError('Microphone permission is required for this call.');
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
      setControlError(null);
    } catch {
      setControlError('Camera permission is required for video calls.');
    }
  };

  const flipCamera = () => {
    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const mediaTrack = publication?.track?.mediaStreamTrack as
      (MediaStreamTrack & { _switchCamera?: () => void }) | undefined;
    if (mediaTrack?._switchCamera) mediaTrack._switchCamera();
  };

  const toggleSpeaker = async () => {
    try {
      const outputs = await AudioSession.getAudioOutputs();
      const target = speakerOn
        ? PlatformAudioOutput.earpiece(outputs)
        : PlatformAudioOutput.speaker(outputs);
      if (!target) throw new Error('Audio output unavailable');
      await AudioSession.selectAudioOutput(target);
      setSpeakerOn(!speakerOn);
      setControlError(null);
    } catch {
      setControlError('Could not change the audio output on this device.');
    }
  };

  return (
    <View style={styles.callStage}>
      {isVideo && remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.remotePlaceholder}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={38} color="#E7EBD9" />
          </View>
          <AppText style={styles.remoteName}>
            {participants.length > 1 ? 'Connected participant' : 'Waiting for the other person'}
          </AppText>
          <AppText style={styles.roomHint}>
            {session.type === 'AUDIO' ? 'Audio call' : 'Video call'}
          </AppText>
        </View>
      )}

      {isVideo && localTrack ? (
        <View style={styles.localPreview}>
          <VideoTrack trackRef={localTrack} style={styles.localVideo} objectFit="cover" mirror />
        </View>
      ) : null}

      <View style={styles.topBar}>
        <View style={styles.callBadge}>
          <Ionicons name={isVideo ? 'videocam' : 'mic'} size={15} color="#F0D38B" />
          <AppText style={styles.callBadgeText}>{isVideo ? 'VIDEO CALL' : 'AUDIO CALL'}</AppText>
        </View>
        <AppText style={styles.connection}>{connectionLabel}</AppText>
      </View>

      <View style={styles.bottomArea}>
        <InlineError message={controlError} />
        <View style={styles.controls}>
          <CallControl
            icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            onPress={() => void toggleMic()}
          />
          {isVideo ? (
            <CallControl
              icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
              label={isCameraEnabled ? 'Camera' : 'Camera off'}
              onPress={() => void toggleCamera()}
            />
          ) : null}
          <CallControl
            icon={speakerOn ? 'volume-high' : 'phone-portrait-outline'}
            label={speakerOn ? 'Speaker' : 'Earpiece'}
            onPress={() => void toggleSpeaker()}
          />
          {isVideo ? <CallControl icon="camera-reverse" label="Flip" onPress={flipCamera} /> : null}
          <Pressable accessibilityRole="button" onPress={onEnd} style={styles.endButton}>
            <Ionicons name="call" size={21} color="#FFFFFF" style={styles.endIcon} />
            <AppText style={styles.controlLabel}>End</AppText>
          </Pressable>
        </View>
        <AppText style={styles.encryptionNote}>Private room · No phone numbers shared</AppText>
      </View>
    </View>
  );
}

function CallControl({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.control}>
      <View style={styles.controlIcon}>
        <Ionicons name={icon} size={20} color="#F6F5EE" />
      </View>
      <AppText style={styles.controlLabel}>{label}</AppText>
    </Pressable>
  );
}

const PlatformAudioOutput = {
  earpiece(outputs: string[]) {
    return outputs.includes('earpiece')
      ? 'earpiece'
      : outputs.includes('default')
        ? 'default'
        : null;
  },
  speaker(outputs: string[]) {
    return outputs.includes('speaker')
      ? 'speaker'
      : outputs.includes('force_speaker')
        ? 'force_speaker'
        : null;
  },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#14271E' },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#14271E',
    padding: 24,
  },
  connecting: { color: '#E6E9DE', fontSize: 14, fontWeight: '600' },
  errorContent: { width: '100%', maxWidth: 400, alignItems: 'center', gap: 12 },
  errorTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  leaveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    borderRadius: 16,
    backgroundColor: theme.colors.brand,
  },
  leaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  callStage: { flex: 1, backgroundColor: '#14271E' },
  remoteVideo: { ...StyleSheet.absoluteFill, zIndex: 0 },
  remotePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1D372A',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#355642',
  },
  remoteName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 10 },
  roomHint: { color: '#B7C4B5', fontSize: 13 },
  localPreview: {
    position: 'absolute',
    zIndex: 2,
    top: 94,
    right: 18,
    width: 102,
    height: 145,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF55',
    backgroundColor: '#293D30',
  },
  localVideo: { flex: 1, width: '100%', height: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 62,
    paddingHorizontal: 20,
    gap: 9,
    alignItems: 'flex-start',
  },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    backgroundColor: '#1C3428E8',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  callBadgeText: { color: '#F6F5EE', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  connection: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: '#00000088',
    textShadowRadius: 8,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 15,
    paddingBottom: 32,
    paddingTop: 38,
    backgroundColor: '#14271ED9',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    gap: 5,
  },
  control: { minWidth: 54, alignItems: 'center', gap: 7 },
  controlIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF22',
  },
  controlLabel: { color: '#F6F5EE', fontSize: 10, fontWeight: '600' },
  endButton: { minWidth: 56, alignItems: 'center', gap: 7 },
  endIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#D4473E',
    transform: [{ rotate: '135deg' }],
  },
  encryptionNote: { color: '#A8B7AA', fontSize: 10, textAlign: 'center', marginTop: 18 },
});
