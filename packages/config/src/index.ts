import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().default('amqp://traveler:traveler123@localhost:5672'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const gatewayEnvSchema = baseEnvSchema.extend({
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  TRIP_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  PLACE_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  NAVIGATION_SERVICE_URL: z.string().url().default('http://localhost:4005'),
  SOCIAL_SERVICE_URL: z.string().url().default('http://localhost:4006'),
  CHAT_SERVICE_URL: z.string().url().default('http://localhost:4007'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:4008'),
  MEDIA_SERVICE_URL: z.string().url().default('http://localhost:4009'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:4010'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:4011'),
  BUSINESS_SERVICE_URL: z.string().url().default('http://localhost:4012'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function validateEnv<T extends z.ZodTypeAny>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
