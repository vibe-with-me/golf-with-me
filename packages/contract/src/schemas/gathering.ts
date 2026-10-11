import { z } from 'zod';
import { PublicProfileSchema } from './profile.ts';

/** An emptied location means "no location": the entity never carries ''. */
const LocationInputSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** A gathering as its members see it. host_id tells the UI who runs it. */
export const GatheringSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120),
  starts_at: z.iso.datetime({ offset: true }),
  location: z.string().min(1).max(160).nullable(),
  host_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
});

/**
 * What an anonymous tap on a gathering tag may learn — capability-based:
 * holding the tag is the invitation. Crosses the anonymous resolve boundary,
 * so nothing private ever joins this pick.
 */
export const GatheringSummarySchema = GatheringSchema.pick({
  id: true,
  title: true,
  starts_at: true,
  location: true,
});

/** A member as co-members see them: the card plus when they joined. */
export const GatheringMemberSchema = z.object({
  joined_at: z.iso.datetime({ offset: true }),
  profile: PublicProfileSchema,
});

export const CreateGatheringInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  starts_at: z.iso.datetime({ offset: true }),
  location: LocationInputSchema,
});

/** Host-only patch; the id travels in the path. At least one field. */
export const UpdateGatheringInputSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120).optional(),
    starts_at: z.iso.datetime({ offset: true }).optional(),
    location: LocationInputSchema,
  })
  .refine(
    (patch) =>
      patch.title !== undefined || patch.starts_at !== undefined || patch.location !== undefined,
    { message: 'Nothing to update' },
  );

export type Gathering = z.infer<typeof GatheringSchema>;
export type GatheringSummary = z.infer<typeof GatheringSummarySchema>;
export type GatheringMember = z.infer<typeof GatheringMemberSchema>;
export type CreateGatheringInput = z.infer<typeof CreateGatheringInputSchema>;
export type UpdateGatheringInput = z.infer<typeof UpdateGatheringInputSchema>;
