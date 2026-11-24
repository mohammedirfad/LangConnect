import type { UserRole } from '@prisma/client';

export function canRoleAccess(requiredRoles: readonly UserRole[], actualRole: UserRole): boolean {
  return requiredRoles.includes(actualRole);
}
