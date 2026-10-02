import { z } from 'zod';

export const updateFileVisibilitySchema = z.object({
  visibleToClient: z.boolean(),
});

export type UpdateFileVisibilityInput = z.infer<typeof updateFileVisibilitySchema>;