import argon2 from 'argon2';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../../lib/app-error.js';
import type { AuthSessionDto, AuthUserDto } from './auth.dto.js';
import type { AuthRepositoryPort, StoredUser } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const passwordHashOptions: argon2.Options & { type: number } = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
};

export interface AuthServiceConfig {
  accessSecret: string;
  accessTokenTtl: '15m';
  refreshTokenTtlDays: number;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepositoryPort,
    private readonly config: AuthServiceConfig,
  ) {}

  async register(input: RegisterInput): Promise<AuthSessionDto> {
    const refreshToken = this.newRefreshToken();
    const user = await this.repository.createUserWithSession({
      user: {
        email: input.email.trim().toLowerCase(),
        passwordHash: await argon2.hash(input.password, passwordHashOptions),
        displayName: input.displayName.trim(),
        role: input.role,
      },
      session: {
        tokenHash: hashRefreshToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: this.refreshExpiry(),
      },
    });
    return this.createSessionDto(user, refreshToken);
  }

  async login(input: LoginInput): Promise<AuthSessionDto> {
    const user = await this.repository.findUserByEmail(input.email.trim().toLowerCase());
    if (!user) {
      // Keep unknown-email attempts close to the normal Argon2 verification cost.
      await argon2.hash(input.password, passwordHashOptions);
      throw this.invalidCredentials();
    }
    if (!(await argon2.verify(user.passwordHash, input.password))) {
      throw this.invalidCredentials();
    }

    const refreshToken = this.newRefreshToken();
    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: this.refreshExpiry(),
    });
    return this.createSessionDto(user, refreshToken);
  }

  async refresh(refreshToken: string): Promise<AuthSessionDto> {
    const nextRefreshToken = this.newRefreshToken();
    const result = await this.repository.rotateRefreshToken({
      currentTokenHash: hashRefreshToken(refreshToken),
      nextToken: {
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: this.refreshExpiry(),
      },
      now: new Date(),
    });
    if (result.status !== 'rotated') {
      throw new AppError(
        401,
        'INVALID_REFRESH_TOKEN',
        'Your session has expired. Please sign in again.',
      );
    }
    return this.createSessionDto(result.user, nextRefreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshToken(hashRefreshToken(refreshToken), new Date());
  }

  async getUser(id: string): Promise<AuthUserDto> {
    const user = await this.repository.findPublicUserById(id);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in again.');
    return this.toUserDto(user);
  }

  private createSessionDto(user: StoredUser, refreshToken: string): AuthSessionDto {
    const accessToken = jwt.sign({ role: user.role }, this.config.accessSecret, {
      algorithm: 'HS256',
      subject: user.id,
      issuer: 'landconnect-api',
      audience: 'landconnect-mobile',
      expiresIn: this.config.accessTokenTtl,
    });
    return { user: this.toUserDto(user), accessToken, refreshToken };
  }

  private toUserDto(
    user: Pick<StoredUser, 'id' | 'email' | 'displayName' | 'role' | 'createdAt'>,
  ): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  }

  private invalidCredentials(): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
}
