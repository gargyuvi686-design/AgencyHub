import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerAgencySchema = z.object({
  agencyName: z.string().trim().min(2, 'Agency name must be at least 2 characters').max(255),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters').max(255),
  contactEmail: z.string().trim().email('A valid contact email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  contactPhone: z.string().trim().optional(),
});

export type RegisterAgencyInput = z.infer<typeof registerAgencySchema>;

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
