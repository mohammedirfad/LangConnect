import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './store';
import type { AuthSession } from './types';

const refreshTokenKey = 'landconnect.refresh-token';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
let refreshFlight: Promise<string> | null = null;

async function clearStoredSession(): Promise<void> {
  try {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(refreshTokenKey);
  } finally {
    useAuthStore.getState().clearSession();
  }
}

export async function persistSession(session: AuthSession): Promise<void> {
  if (Platform.OS === 'web') {
    // Keep browser-preview tokens in memory only; never fall back to localStorage.
    useAuthStore.getState().setSession(session.user, session.accessToken, session.refreshToken);
    return;
  }
  await SecureStore.setItemAsync(refreshTokenKey, session.refreshToken);
  useAuthStore.getState().setSession(session.user, session.accessToken, null);
}

async function requestRefresh(): Promise<string> {
  const refreshToken =
    Platform.OS === 'web'
      ? useAuthStore.getState().refreshToken
      : await SecureStore.getItemAsync(refreshTokenKey);
  if (!refreshToken || !apiBaseUrl) {
    await clearStoredSession();
    throw new Error('Your session has expired. Please sign in again.');
  }

  try {
    const response = await axios.post<AuthSession>(
      `${apiBaseUrl}/api/v1/auth/refresh`,
      { refreshToken },
      { timeout: 12_000 },
    );
    await persistSession(response.data);
    return response.data.accessToken;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await clearStoredSession();
    }
    throw error;
  }
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshFlight) {
    refreshFlight = requestRefresh().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  store.setHydrating(true);
  store.setBootstrapError(null);
  if (Platform.OS === 'web') {
    // Browser preview is intentionally signed out after a page reload.
    store.clearSession();
    store.setHydrating(false);
    return;
  }
  try {
    const refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
    if (!refreshToken) {
      store.clearSession();
      return;
    }
    await refreshAccessToken();
  } catch {
    useAuthStore
      .getState()
      .setBootstrapError(
        'Could not restore your session. Check your connection and sign in again.',
      );
  } finally {
    useAuthStore.getState().setHydrating(false);
  }
}

export async function revokeAndClearSession(): Promise<void> {
  try {
    const refreshToken =
      Platform.OS === 'web'
        ? useAuthStore.getState().refreshToken
        : await SecureStore.getItemAsync(refreshTokenKey);
    if (refreshToken && apiBaseUrl) {
      await axios.post(`${apiBaseUrl}/api/v1/auth/logout`, { refreshToken }, { timeout: 12_000 });
    }
  } catch {
    // Local sign-out must still work when the API is unreachable.
  } finally {
    await clearStoredSession();
  }
}
