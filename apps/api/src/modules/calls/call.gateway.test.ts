import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env.js';
import { verifyCallSocketToken } from './call.gateway.js';

function token(overrides: jwt.SignOptions = {}, role: string = UserRole.BUYER) {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: randomUUID(),
    issuer: 'landconnect-api',
    audience: 'landconnect-mobile',
    expiresIn: '15m',
    ...overrides,
  });
}

test('call socket accepts only valid access tokens with the expected role and audience', () => {
  const userId = randomUUID();
  const validToken = token({ subject: userId });
  assert.deepEqual(verifyCallSocketToken(validToken), { userId, role: UserRole.BUYER });
  assert.equal(verifyCallSocketToken(undefined), null);
  assert.equal(verifyCallSocketToken('not-a-jwt'), null);
  assert.equal(verifyCallSocketToken(token({ expiresIn: '-1s' })), null);
  assert.equal(verifyCallSocketToken(token({ audience: 'another-app' })), null);
  assert.equal(verifyCallSocketToken(token({}, 'ADMIN')), null);
});
