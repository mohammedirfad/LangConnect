export type UserRole = 'BUYER' | 'SELLER' | 'BROKER';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}
