import { apiClient } from '../api/client';
import type { AuthSession, LoginInput, RegisterInput } from './types';

export const authApi = {
  async register(input: RegisterInput): Promise<AuthSession> {
    const response = await apiClient.post<AuthSession>('/auth/register', input);
    return response.data;
  },
  async login(input: LoginInput): Promise<AuthSession> {
    const response = await apiClient.post<AuthSession>('/auth/login', input);
    return response.data;
  },
};
