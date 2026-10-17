import { z } from 'zod';
import { TERMS_VERSION } from './terms.ts';
import { PLAIN_TEXT_MESSAGE, isPlainText } from './text.ts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The Storage bucket every avatar lives in: public read by path, per-user folders, never listable. */
export const AVATARS_BUCKET = 'avatars';

/**
 * The upload cap (1 MiB). The contract validates the file's size, but only
 * after oRPC has buffered the whole multipart body, so the API also rejects
 * an oversized request by its Content-Length before reading it; the bucket's
 * file_size_limit is the last line. Clients send 512px squares, far below it.
 */
export const AVATAR_MAX_BYTES = 1_048_576;

/**
 * Where an avatar lives inside the bucket: `<user-uuid>/<uuid>.(webp|jpg)`,
 * lowercase, one folder deep. A path, never a URL: an off-origin avatar is
 * unrepresentable, and each client builds the URL from its own configured
 * Supabase URL with avatarPublicUrl(). The database CHECK also binds the
 * folder to the profile's own id.
 */
export const AvatarPathSchema = z
  .string()
  .regex(new RegExp(`^${UUID}/${UUID}\\.(webp|jpg)$`), 'Expected <user-uuid>/<uuid>.(webp|jpg)');

/** The public URL for an avatar path, built from the caller's own Supabase URL. */
export function avatarPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
}

const DisplayNameSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((v) => isPlainText(v), PLAIN_TEXT_MESSAGE);
const BioSchema = z
  .string()
  .max(280)
  .refine((v) => isPlainText(v, { multiline: true }), PLAIN_TEXT_MESSAGE);

/** Card tier: a free-text line on the card (the home course). Crosses the anonymous resolve boundary. DB CHECK mirrors it. */
export const CardLineSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((v) => isPlainText(v), PLAIN_TEXT_MESSAGE);

/**
 * Card tier: a handicap index, -10.0 to 54.0 in tenths. A plus handicap is
 * stored negative and printed with a plus ("+2.4"), never a minus. The DB
 * CHECK enforces the range; numeric(3,1) rounds, so precision is zod's alone.
 */
export const HANDICAP_MIN = -10;
export const HANDICAP_MAX = 54;
export const HandicapSchema = z.number().min(HANDICAP_MIN).max(HANDICAP_MAX).multipleOf(0.1);

/**
 * A handicap as typed: blank is null (clears the field), "14.2" or "+2.4" is
 * the value (a plus handicap comes back negative), anything else is
 * undefined (refused). Range-checked with HandicapSchema itself.
 */
export function parseHandicap(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const match = /^(\+)?([0-9]{1,2})(?:\.([0-9]))?$/.exec(trimmed);
  if (!match) return undefined;
  const magnitude = Number(`${match[2]}.${match[3] ?? '0'}`);
  const value = match[1] && magnitude !== 0 ? -magnitude : magnitude;
  return HandicapSchema.safeParse(value).success ? value : undefined;
}

/** "14.2", "0.0", "+2.4": one decimal, a plus handicap with a plus. */
export function formatHandicap(value: number): string {
  return value < 0 ? `+${(-value).toFixed(1)}` : value.toFixed(1);
}

/**
 * The card's golf line: "Handicap +2.4 · Riverside Muni", either part alone
 * when only one is set, null when neither is. Both clients print it the same.
 */
export function golfLine(card: {
  handicap?: number | null;
  home_course?: string | null;
}): string | null {
  const parts = [
    card.handicap === null || card.handicap === undefined
      ? null
      : `Handicap ${formatHandicap(card.handicap)}`,
    card.home_course ?? null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const ProfileSchema = z.object({
  id: z.uuid(),
  display_name: DisplayNameSchema,
  avatar_path: AvatarPathSchema.nullable(),
  bio: BioSchema.nullable(),
  handicap: HandicapSchema.nullable(),
  home_course: CardLineSchema.nullable(),
  // Which terms the owner agreed to, and when (stamped by the database).
  // Null on a profile made before terms existed: the shells ask on next open.
  terms_version: z.string().nullable(),
  terms_accepted_at: z.iso.datetime({ offset: true }).nullable(),
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
  avatar_path: true,
  bio: true,
  handicap: true,
  home_course: true,
});

/**
 * Name, bio, and the vertical fields (the card tier's columns: handicap and
 * home course). The photo has its own endpoints (uploadAvatar /
 * removeAvatar): a path is chosen by the API, never by the client, so this
 * input has no avatar key at all (unknown keys are stripped).
 *
 * `terms_version` is the sign-up agreement: creating a profile requires it
 * (the "I agree" box), and it can only be the current TERMS_VERSION.
 */
export const UpdateProfileInputSchema = z.object({
  display_name: DisplayNameSchema.optional(),
  bio: BioSchema.nullable().optional(),
  handicap: HandicapSchema.nullable().optional(),
  home_course: CardLineSchema.nullable().optional(),
  terms_version: z.literal(TERMS_VERSION).optional(),
});

/**
 * A photo the client has already squared and resized to 512px. The API
 * reads the bytes to decide JPEG or WebP (a declared type is the client's
 * claim, not a fact), so there is no mime rule here.
 */
export const AvatarUploadInputSchema = z.object({
  file: z.file().min(1).max(AVATAR_MAX_BYTES),
});

export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Fields a profile needs before the signed-in shell opens. A UX gate, never
 * a safety boundary: the columns stay nullable, and no policy or RPC reads
 * completion. Both clients import this one definition. Golf With Me asks for
 * the name alone: handicap and home course are optional.
 */
export const REQUIRED_PROFILE_FIELDS = ['display_name'] as const satisfies readonly (keyof Profile)[];

export function isProfileComplete(profile: Profile | null | undefined): profile is Profile {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((field) => {
    const value: unknown = profile[field];
    return typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined;
  });
}
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
export type AvatarUploadInput = z.infer<typeof AvatarUploadInputSchema>;
