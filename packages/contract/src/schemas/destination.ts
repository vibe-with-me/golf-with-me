import { z } from 'zod';

/**
 * The typed destination a tag points at — the one shared definition for DB
 * validation, API, web, SDK, and future mobile. V1 ships only 'profile';
 * future types (link, menu, vcard, …) join this union without schema change.
 */
export const ProfileDestinationSchema = z.object({
  type: z.literal('profile'),
});

export const DestinationSchema = z.discriminatedUnion('type', [ProfileDestinationSchema]);

export type Destination = z.infer<typeof DestinationSchema>;
