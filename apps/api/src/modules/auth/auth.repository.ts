import { Prisma, type UserRole } from '@prisma/client';
import type { PrismaService } from '../../lib/prisma.js';

const storedUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
  passwordHash: true,
} satisfies Prisma.UserSelect;

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type StoredUser = Prisma.UserGetPayload<{ select: typeof storedUserSelect }>;
export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface CreateUserSessionInput {
  user: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: UserRole;
  };
  session: Omit<CreateSessionInput, 'userId'>;
}

export type RefreshRotationResult =
  { status: 'invalid' } | { status: 'reused' } | { status: 'rotated'; user: StoredUser };

export interface AuthRepositoryPort {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findPublicUserById(id: string): Promise<PublicUser | null>;
  createUserWithSession(input: CreateUserSessionInput): Promise<StoredUser>;
  createSession(input: CreateSessionInput): Promise<void>;
  rotateRefreshToken(input: {
    currentTokenHash: string;
    nextToken: Omit<CreateSessionInput, 'userId' | 'familyId'>;
    now: Date;
  }): Promise<RefreshRotationResult>;
  revokeRefreshToken(tokenHash: string, now: Date): Promise<void>;
}

export class AuthRepository implements AuthRepositoryPort {
  constructor(private readonly database: PrismaService) {}

  findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.database.user.findUnique({ where: { email }, select: storedUserSelect });
  }

  findPublicUserById(id: string): Promise<PublicUser | null> {
    return this.database.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  createUserWithSession(input: CreateUserSessionInput): Promise<StoredUser> {
    return this.database.$transaction(async (transaction) => {
      const user = await transaction.user.create({ data: input.user, select: storedUserSelect });
      await transaction.refreshToken.create({
        data: { ...input.session, userId: user.id },
      });
      return user;
    });
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    await this.database.refreshToken.create({ data: input });
  }

  rotateRefreshToken(input: {
    currentTokenHash: string;
    nextToken: Omit<CreateSessionInput, 'userId' | 'familyId'>;
    now: Date;
  }): Promise<RefreshRotationResult> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.refreshToken.findUnique({
        where: { tokenHash: input.currentTokenHash },
        include: { user: { select: storedUserSelect } },
      });
      if (!current) return { status: 'invalid' };

      if (current.revokedAt) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return { status: 'reused' };
      }

      if (current.expiresAt <= input.now) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return { status: 'invalid' };
      }

      const claimed = await transaction.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null, expiresAt: { gt: input.now } },
        data: { revokedAt: input.now },
      });
      if (claimed.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return { status: 'reused' };
      }

      await transaction.refreshToken.create({
        data: {
          ...input.nextToken,
          userId: current.userId,
          familyId: current.familyId,
        },
      });
      return { status: 'rotated', user: current.user };
    });
  }

  async revokeRefreshToken(tokenHash: string, now: Date): Promise<void> {
    await this.database.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
