import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const sendRegisterOtpSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    mobile: z.string().regex(/^\+?[0-9]{8,15}$/, 'Enter a valid mobile number'),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyRegisterOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4, 'OTP is required'),
});

export const registerSchema = sendRegisterOtpSchema;

export const SOCIAL_PLATFORMS = [
  'instagram',
  'twitter',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'snapchat',
  'website',
] as const;

export const updateProfileSchema = z.object({
  displayName: z.string().max(60, 'Display name is too long').optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional(),
  location: z.string().max(120, 'Location is too long').optional(),
  website: z
    .string()
    .max(200)
    .refine((value) => value === '' || /^https?:\/\/.+/.test(value), {
      message: 'Enter a full URL including https://',
    })
    .optional(),
});

export const upsertSocialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z
    .string()
    .min(1, 'URL is required')
    .max(300)
    .regex(/^https?:\/\/.+/, 'Enter a full URL including https://'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpsertSocialLinkInput = z.infer<typeof upsertSocialLinkSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendRegisterOtpInput = z.infer<typeof sendRegisterOtpSchema>;
export type VerifyRegisterOtpInput = z.infer<typeof verifyRegisterOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
