import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ConnectRequestSchema, ConnectionSchema } from '../schemas/connection.ts';
import { DestinationSchema } from '../schemas/destination.ts';
import {
  CreateGatheringInputSchema,
  GatheringMemberSchema,
  GatheringSchema,
  UpdateGatheringInputSchema,
} from '../schemas/gathering.ts';
import { ProfileSchema, PublicProfileSchema, UpdateProfileInputSchema } from '../schemas/profile.ts';
import { TagSchema, TagUidSchema } from '../schemas/tag.ts';

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

const createGathering = oc
  .route({ method: 'POST', path: '/gatherings', tags: ['Gatherings'] })
  .input(CreateGatheringInputSchema)
  .output(z.object({ gathering: GatheringSchema }));

const getGathering = oc
  .route({ method: 'GET', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  // Not-found and blocked-by-host are the same NOT_FOUND error — a gathering
  // you may not see is a gathering that does not exist.
  .output(z.object({ gathering: GatheringSchema, members: z.array(GatheringMemberSchema) }));

const joinGathering = oc
  .route({ method: 'POST', path: '/gatherings/{id}/join', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const leaveGathering = oc
  .route({ method: 'POST', path: '/gatherings/{id}/leave', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const listMyGatherings = oc
  .route({ method: 'GET', path: '/gatherings', tags: ['Gatherings'] })
  // Bare RLS-scoped list of the caller's own gatherings. This is NOT a browse
  // surface and must never grow into one.
  .output(z.object({ gatherings: z.array(GatheringSchema) }));

const updateGathering = oc
  .route({ method: 'PATCH', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(UpdateGatheringInputSchema)
  // Host-only; a non-host's patch is NOT_FOUND, same as a stranger's read.
  .output(z.object({ gathering: GatheringSchema }));

const removeGathering = oc
  .route({ method: 'DELETE', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

// My tags, minimal in M2 (the gathering detail's "point my tags here").
// M3 extends `update` with `status` and builds the Profile section on these.
const listMyTags = oc
  .route({ method: 'GET', path: '/me/tags', tags: ['Tags'] })
  .output(z.object({ tags: z.array(TagSchema) }));

const updateMyTag = oc
  .route({ method: 'PATCH', path: '/me/tags/{uid}', tags: ['Tags'] })
  .input(z.object({ uid: TagUidSchema, destination: DestinationSchema }))
  .output(z.object({ tag: TagSchema }));

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
  gatherings: {
    create: createGathering,
    get: getGathering,
    join: joinGathering,
    leave: leaveGathering,
    listMine: listMyGatherings,
    update: updateGathering,
    remove: removeGathering,
  },
  tags: { listMine: listMyTags, update: updateMyTag },
};
