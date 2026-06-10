import { oc } from '@orpc/contract';
import { z } from 'zod';
import { DestinationSchema } from '../schemas/destination.ts';
import { PublicProfileSchema } from '../schemas/profile.ts';
import { TagSchema, TagUidSchema } from '../schemas/tag.ts';

/**
 * What a tap resolves to. A viewer blocked by the tag owner receives
 * 'disabled' — indistinguishable from a deactivated tag, by design.
 */
export const ResolveOutputSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unclaimed'), uid: TagUidSchema }),
  z.object({
    status: z.literal('claimed'),
    uid: TagUidSchema,
    destination: DestinationSchema,
    profile: PublicProfileSchema,
  }),
  z.object({ status: z.literal('disabled'), uid: TagUidSchema }),
]);

export type ResolveOutput = z.infer<typeof ResolveOutputSchema>;

const resolve = oc
  .route({ method: 'GET', path: '/tags/{uid}', tags: ['Tags'] })
  .input(z.object({ uid: TagUidSchema }))
  .output(ResolveOutputSchema);

const claim = oc
  .route({ method: 'POST', path: '/tags/{uid}/claim', tags: ['Tags'] })
  .input(
    z.object({
      uid: TagUidSchema,
      destination: DestinationSchema.default({ type: 'profile' }),
    }),
  )
  .output(z.object({ tag: TagSchema }));

const logScan = oc
  .route({ method: 'POST', path: '/tags/{uid}/scans', tags: ['Tags'] })
  .input(
    z.object({
      uid: TagUidSchema,
      // Privacy-default: no GPS, no IP, no fingerprinting — UA string only.
      user_agent: z.string().max(512).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }));

/** Tag-scoped surface — what the SDK wraps. resolve/logScan are anonymous; claim requires auth. */
export const publicContract = { resolve, claim, logScan };
