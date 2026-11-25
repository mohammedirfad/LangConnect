import { create } from 'zustand';
import type { CallDto, CallStatus, CallType } from './api';

export interface LiveCallSession {
  callId: string;
  roomName: string;
  type: CallType;
  url: string;
  token: string;
}

interface CallState {
  session: LiveCallSession | null;
  incomingCall: CallDto | null;
  outgoingCall: CallDto | null;
  lastOutcome: CallStatus | null;
  setSession: (session: LiveCallSession) => void;
  setIncomingCall: (call: CallDto | null) => void;
  setOutgoingCall: (call: CallDto | null) => void;
  setLastOutcome: (outcome: CallStatus | null) => void;
  clearSession: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  session: null,
  incomingCall: null,
  outgoingCall: null,
  lastOutcome: null,
  setSession: (session) => set({ session }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  setOutgoingCall: (outgoingCall) => set({ outgoingCall }),
  setLastOutcome: (lastOutcome) => set({ lastOutcome }),
  clearSession: () => set({ session: null, incomingCall: null, outgoingCall: null }),
}));
