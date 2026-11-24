import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { AppError } from '../../lib/app-error.js';
import {
  type AuthRepositoryPort,
  type CreateSessionInput,
  type CreateUserSessionInput,
  type PublicUser,
  type RefreshRotationResult,
  type StoredUser,
} from './auth.repository.js';
import { AuthService } from './auth.service.js';

class MemoryAuthRepository implements AuthRepositoryPort {
  readonly users = new Map<string, StoredUser>();
  readonly tokens = new Map<string, CreateSessionInput & { revokedAt: Date | null }>();

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findPublicUserById(id: string): Promise<PublicUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async createUserWithSession(input: CreateUserSessionInput): Promise<StoredUser> {
    const user: StoredUser = {
      id: randomUUID(),
      ...input.user,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.tokens.set(input.session.tokenHash, {
      ...input.session,
      userId: user.id,
      revokedAt: null,
    });
    return user;
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    this.tokens.set(input.tokenHash, { ...input, revokedAt: null });
  }

  async rotateRefreshToken(input: {
    currentTokenHash: string;
    nextToken: Omit<CreateSessionInput, 'userId' | 'familyId'>;
    now: Date;
  }): Promise<RefreshRotationResult> {
    const current = this.tokens.get(input.currentTokenHash);
    if (!current) return { status: 'invalid' };
    if (current.revokedAt) {
      this.revokeFamily(current.familyId, input.now);
      return { status: 'reused' };
    }
    if (current.expiresAt <= input.now) {
      this.revokeFamily(current.familyId, input.now);
      return { status: 'invalid' };
    }
    current.revokedAt = input.now;
    this.tokens.set(input.nextToken.tokenHash, {
      ...input.nextToken,
      userId: current.userId,
      familyId: current.familyId,
      revokedAt: null,
    });
    const user = this.users.get(current.userId);
    assert.ok(user);
    return { status: 'rotated', user };
  }

  async revokeRefreshToken(tokenHash: string, now: Date): Promise<void> {
    const token = this.tokens.get(tokenHash);
    if (token && !token.revokedAt) token.revokedAt = now;
  }

  private revokeFamily(familyId: string, now: Date): void {
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) token.revokedAt = now;
    }
  }
}

const serviceConfig = {
  accessSecret: 'a-test-secret-that-is-long-enough-for-hs256',
  accessTokenTtl: '15m' as const,
  refreshTokenTtlDays: 30,
};

test('registration normalizes email and stores only a password hash', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository, serviceConfig);
  const session = await service.register({
    email: '  Buyer@Example.com ',
    password: 'a-long-test-password',
    displayName: ' Test Buyer ',
    role: UserRole.BUYER,
  });

  assert.equal(session.user.email, 'buyer@example.com');
  assert.equal(session.user.displayName, 'Test Buyer');
  assert.notEqual(repository.users.get(session.user.id)?.passwordHash, 'a-long-test-password');
  assert.equal(session.refreshToken.length, 43);
});

test('refresh rotates once and replay revokes the token family', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository, serviceConfig);
  const initial = await service.register({
    email: 'seller@example.com',
    password: 'another-long-test-password',
    displayName: 'Seller',
    role: UserRole.SELLER,
  });

  const rotated = await service.refresh(initial.refreshToken);
  assert.notEqual(rotated.refreshToken, initial.refreshToken);
  await assert.rejects(service.refresh(initial.refreshToken), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'INVALID_REFRESH_TOKEN');
    return true;
  });
  await assert.rejects(service.refresh(rotated.refreshToken), AppError);
});

test('login returns the same credential error for unknown users and wrong passwords', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository, serviceConfig);
  await service.register({
    email: 'buyer@example.com',
    password: 'correct-long-password',
    displayName: 'Buyer',
    role: UserRole.BUYER,
  });

  const errors: AppError[] = [];
  for (const email of ['missing@example.com', 'buyer@example.com']) {
    try {
      await service.login({ email, password: 'wrong-long-password' });
    } catch (error) {
      assert.ok(error instanceof AppError);
      errors.push(error);
    }
  }
  assert.equal(errors.length, 2);
  assert.equal(errors[0]?.statusCode, 401);
  assert.equal(errors[0]?.message, errors[1]?.message);
});
