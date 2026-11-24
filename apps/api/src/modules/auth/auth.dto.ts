import type { UserRole } from '@prisma/client';

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}
