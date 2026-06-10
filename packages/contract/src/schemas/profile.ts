import { z } from 'zod';

/**
 * https-only and length-capped: the avatar URL is the one stored,
 * user-controlled URL in the system and is rendered by every client.
 */
export const AvatarUrlSchema = z.url({ protocol: /^https$/ }).max(2048);

export const ProfileSchema = z.object({
  id: z.uuid(),
  display_name: z.string().min(1).max(80),
  avatar_url: AvatarUrlSchema.nullable(),
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
  avatar_url: AvatarUrlSchema.nullable().optional(),
  bio: z.string().max(280).nullable().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
