import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserRole } from '@prisma/client';
import { canRoleAccess } from './rbac.js';

test('listing creation roles include sellers and brokers, but not buyers', () => {
  const allowed = [UserRole.SELLER, UserRole.BROKER] as const;
  assert.equal(canRoleAccess(allowed, UserRole.SELLER), true);
  assert.equal(canRoleAccess(allowed, UserRole.BROKER), true);
  assert.equal(canRoleAccess(allowed, UserRole.BUYER), false);
});
