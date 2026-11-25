import { io, type Socket } from 'socket.io-client';
import { refreshAccessToken } from '../auth/session';
import { useAuthStore } from '../auth/store';

type AckResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
let socket: Socket | null = null;
let refreshingSocketToken = false;

function getSocket(): Socket {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL must be configured.');
  if (!socket) {
    socket = io(apiUrl, {
      autoConnect: false,
      timeout: 10_000,
      auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    });
    socket.on('connect_error', (error) => {
      if (error.message !== 'unauthorized' || refreshingSocketToken) return;
      refreshingSocketToken = true;
      void refreshAccessToken()
        .then(() => {
          if (socket) socket.connect();
        })
        .catch(() => undefined)
        .finally(() => {
          refreshingSocketToken = false;
        });
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io server disconnect' || !useAuthStore.getState().accessToken) return;
      if (refreshingSocketToken) return;
      refreshingSocketToken = true;
      void refreshAccessToken()
        .then(() => socket?.connect())
        .catch(() => undefined)
        .finally(() => {
          refreshingSocketToken = false;
        });
    });
  }
  return socket;
}

export function connectCallSocket(): void {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;
  const client = getSocket();
  if (!client.connected) client.connect();
}

export function disconnectCallSocket(): void {
  socket?.disconnect();
}

export function onCallEvent<T>(event: string, listener: (payload: T) => void): () => void {
  const client = getSocket();
  client.on(event, listener);
  return () => client.off(event, listener);
}

export function onCallConnect(listener: () => void): () => void {
  const client = getSocket();
  client.on('connect', listener);
  return () => client.off('connect', listener);
}

export function emitCallEvent<T>(event: string, payload: unknown): Promise<T> {
  const client = getSocket();
  return new Promise((resolve, reject) => {
    if (!client.connected) {
      reject(new Error('Call signaling is reconnecting. Check your connection and try again.'));
      return;
    }
    client
      .timeout(10_000)
      .emit(event, payload, (timeoutError: Error | null, response: AckResult<T>) => {
        if (timeoutError) {
          reject(new Error('The server did not respond. Check your connection and try again.'));
        } else if (!response?.ok) {
          const error = new Error(response?.error.message ?? 'The call action failed.') as Error & {
            code?: string;
          };
          error.code = response?.error.code;
          reject(error);
        } else {
          resolve(response.data);
        }
      });
  });
}

export function isCallSocketConnected(): boolean {
  return socket?.connected ?? false;
}
