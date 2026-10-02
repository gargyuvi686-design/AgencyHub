import { z } from 'zod';

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(255).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  contactName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email('A valid email is required'),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).refine((data) => !!(data.companyName || data.name), {
  message: 'Company name or name is required',
  path: ['name'],
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  companyName: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  contactName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const portalInviteSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  name: z.string().trim().min(1, 'Name is required').max(255).optional(),
});

export type PortalInviteInput = z.infer<typeof portalInviteSchema>;
