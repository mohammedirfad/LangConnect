import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../auth/store';
import { refreshAccessToken } from '../auth/session';

interface RetryableRequest extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

const baseURL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
if (!baseURL) throw new Error('EXPO_PUBLIC_API_URL must be set in apps/mobile/.env.');

export const apiClient = axios.create({
  baseURL: `${baseURL}/api/v1`,
  timeout: 12_000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const request = error.config as RetryableRequest | undefined;
    const endpoint = request?.url ?? '';
    const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some(
      (path) => endpoint.endsWith(path),
    );
    if (
      error.response?.status !== 401 ||
      !request ||
      request._authRetry ||
      isAuthEndpoint ||
      !useAuthStore.getState().accessToken
    ) {
      throw error;
    }

    request._authRetry = true;
    try {
      const accessToken = await refreshAccessToken();
      request.headers.set('Authorization', `Bearer ${accessToken}`);
      return apiClient(request);
    } catch {
      throw error;
    }
  },
);
