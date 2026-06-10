import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ConnectRequestSchema, ConnectionSchema } from '../schemas/connection.ts';
import { ProfileSchema, PublicProfileSchema, UpdateProfileInputSchema } from '../schemas/profile.ts';

const getProfile = oc
  .route({ method: 'GET', path: '/me/profile', tags: ['Profile'] })
  .output(z.object({ profile: ProfileSchema.nullable() }));

const updateProfile = oc
  .route({ method: 'PATCH', path: '/me/profile', tags: ['Profile'] })
  .input(UpdateProfileInputSchema)
  .output(z.object({ profile: ProfileSchema }));

const sendRequest = oc
  .route({ method: 'POST', path: '/connect-requests', tags: ['Connect'] })
  .input(z.object({ recipient_id: z.uuid() }))
  // Deliberately a bare ack: a request silently dropped by a block returns
  // the exact same shape as one that was stored. No signal, ever.
  .output(z.object({ ok: z.literal(true) }));

const listPendingRequests = oc
  .route({ method: 'GET', path: '/connect-requests/pending', tags: ['Connect'] })
  .output(z.object({ requests: z.array(ConnectRequestSchema) }));

const acceptRequest = oc
  .route({ method: 'POST', path: '/connect-requests/{id}/accept', tags: ['Connect'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ connection: ConnectionSchema }));

const declineRequest = oc
  .route({ method: 'POST', path: '/connect-requests/{id}/decline', tags: ['Connect'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const listConnections = oc
  .route({ method: 'GET', path: '/connections', tags: ['Connections'] })
  .output(z.object({ connections: z.array(ConnectionSchema) }));

const removeConnection = oc
  .route({ method: 'DELETE', path: '/connections/{id}', tags: ['Connections'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const block = oc
  .route({ method: 'POST', path: '/blocks', tags: ['Blocks'] })
  .input(z.object({ user_id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const unblock = oc
  .route({ method: 'DELETE', path: '/blocks/{user_id}', tags: ['Blocks'] })
  .input(z.object({ user_id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const listBlocks = oc
  .route({ method: 'GET', path: '/blocks', tags: ['Blocks'] })
  .output(
    z.object({
      blocks: z.array(
        z.object({
          user: PublicProfileSchema,
          created_at: z.iso.datetime({ offset: true }),
        }),
      ),
    }),
  );

/** Session-scoped surface — every procedure requires a verified Supabase JWT. */
export const appContract = {
  profile: { get: getProfile, update: updateProfile },
  requests: {
    send: sendRequest,
    listPending: listPendingRequests,
    accept: acceptRequest,
    decline: declineRequest,
  },
  connections: { list: listConnections, remove: removeConnection },
  blocks: { block, unblock, list: listBlocks },
};
