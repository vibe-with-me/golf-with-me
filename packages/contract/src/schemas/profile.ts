import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.uuid(),
  display_name: z.string().min(1).max(80),
  avatar_url: z.url().nullable(),
  bio: z.string().max(280).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

/**
 * The card. Everything a stranger may see after a tap — and nothing more.
 * Reachable only via a tag scan or an existing connection (no enumeration).
 */
export const PublicProfileSchema = ProfileSchema.pick({
  id: true,
  display_name: true,
  avatar_url: true,
  bio: true,
});

export const UpdateProfileInputSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  avatar_url: z.url().nullable().optional(),
  bio: z.string().max(280).nullable().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
