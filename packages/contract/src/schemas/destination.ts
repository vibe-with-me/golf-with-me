import { z } from 'zod';

/**
 * The typed destination a tag points at — the one shared definition for DB
 * validation, API, web, SDK, and future mobile. The starter ships `profile`
 * and `gathering`; future types (link, menu, vcard, …) join this union
 * without schema change.
 */
export const ProfileDestinationSchema = z.object({
  type: z.literal('profile'),
});

/** Tag -> a gathering: tap the host's tag to join. resolve carries a summary alongside. */
export const GatheringDestinationSchema = z.object({
  type: z.literal('gathering'),
  gathering_id: z.uuid(),
});

export const DestinationSchema = z.discriminatedUnion('type', [
  ProfileDestinationSchema,
  GatheringDestinationSchema,
]);

export type Destination = z.infer<typeof DestinationSchema>;
