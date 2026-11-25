import { CallType } from '@prisma/client';
import { z } from 'zod';

export const createCallSchema = z
  .object({
    calleeId: z.string().uuid(),
    type: z.nativeEnum(CallType),
  })
  .strict();

export const callIdParamsSchema = z.object({ callId: z.string().uuid() }).strict();

export const inviteCallSchema = createCallSchema;
export const callActionSchema = z.object({ callId: z.string().uuid() }).strict();

export type CreateCallInput = z.infer<typeof createCallSchema>;
