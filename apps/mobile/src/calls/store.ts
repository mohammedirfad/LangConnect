import { create } from 'zustand';
import type { CallType } from './api';

export interface LiveCallSession {
  callId: string;
  roomName: string;
  type: CallType;
  url: string;
  token: string;
}

interface CallState {
  session: LiveCallSession | null;
  setSession: (session: LiveCallSession) => void;
  clearSession: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}));
