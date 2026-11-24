import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.literal('15m').default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LIVEKIT_URL: z.string().url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${fields}`);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
