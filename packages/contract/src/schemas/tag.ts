import { z } from 'zod';
import { DestinationSchema } from './destination.ts';

/** Immutable NTAG213-style UID: 7 bytes = 14 hex chars, canonically uppercase. */
export const TagUidSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-F]{14}$/, 'Expected a 14-hex-char NFC UID');

export const TagStatusSchema = z.enum(['unclaimed', 'claimed', 'disabled']);

/** Public shape of a tag. tenant_id and claimed_by never cross the API boundary. */
export const TagSchema = z.object({
  uid: TagUidSchema,
  status: TagStatusSchema,
  destination: DestinationSchema.nullable(),
});

export type TagUid = z.infer<typeof TagUidSchema>;
export type TagStatus = z.infer<typeof TagStatusSchema>;
export type Tag = z.infer<typeof TagSchema>;
