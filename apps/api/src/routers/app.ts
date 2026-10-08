import { ORPCError } from '@orpc/server';
import type { Connection, Gathering, Profile, Tag } from '@withme/contract';
import {
  blockUser,
  deleteGathering,
  getGathering,
  getOwnProfile,
  leaveGathering,
  listBlocks,
  listConnections,
  listGatheringMembers,
  listMyGatherings,
  listOwnTags,
  listPendingRequests,
  removeConnection,
  unblockUser,
  updateGathering,
  updateOwnTagDestination,
  upsertOwnProfile,
} from '@withme/db/queries';
import { throwFromDbError } from '../lib/errors.ts';
import { appProcedure, requireUser } from '../lib/orpc.ts';
import type { ApiContext } from '../lib/orpc.ts';

function isDbError(error: unknown): error is { code: string; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

async function run<T>(context: ApiContext, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDbError(error)) throwFromDbError(error, context.logger);
    throw error;
  }
}

const getProfile = appProcedure.profile.get.handler(async ({ context }) => {
  const userId = requireUser(context);
  const profile = await run(context, () => getOwnProfile(context.db, userId));
  return { profile: profile as Profile | null };
});

const updateProfile = appProcedure.profile.update.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  const profile = await run(context, () => upsertOwnProfile(context.db, userId, input));
  return { profile: profile as Profile };
});

const sendRequest = appProcedure.requests.send.handler(async ({ input, context }) => {
  requireUser(context);
  const { error } = await context.db.rpc('send_connect_request', {
    p_recipient: input.recipient_id,
  });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

const listPending = appProcedure.requests.listPending.handler(async ({ context }) => {
  requireUser(context);
  const rows = await run(context, () => listPendingRequests(context.db));
  return {
    requests: rows.map((row) => ({
      id: row.id,
      requester: row.requester,
      status: 'pending' as const,
      created_at: row.created_at,
      expires_at: row.expires_at,
    })),
  };
});

const acceptRequest = appProcedure.requests.accept.handler(async ({ input, context }) => {
  requireUser(context);
  const { data, error } = await context.db.rpc('accept_connect_request', {
    p_request_id: input.id,
  });
  if (error) throwFromDbError(error, context.logger);
  return { connection: data as unknown as Connection };
});

const declineRequest = appProcedure.requests.decline.handler(async ({ input, context }) => {
  requireUser(context);
  const { error } = await context.db.rpc('decline_connect_request', { p_request_id: input.id });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

const connectionsList = appProcedure.connections.list.handler(async ({ context }) => {
  const userId = requireUser(context);
  const connections = await run(context, () => listConnections(context.db, userId));
  return { connections };
});

const connectionsRemove = appProcedure.connections.remove.handler(async ({ input, context }) => {
  requireUser(context);
  await run(context, () => removeConnection(context.db, input.id));
  return { ok: true as const };
});

const block = appProcedure.blocks.block.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  await run(context, () => blockUser(context.db, userId, input.user_id));
  context.logger.info('user blocked');
  return { ok: true as const };
});

const unblock = appProcedure.blocks.unblock.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  await run(context, () => unblockUser(context.db, userId, input.user_id));
  return { ok: true as const };
});

const blocksList = appProcedure.blocks.list.handler(async ({ context }) => {
  requireUser(context);
  const blocks = await run(context, () => listBlocks(context.db));
  return { blocks };
});

const gatheringsCreate = appProcedure.gatherings.create.handler(async ({ input, context }) => {
  requireUser(context);
  const { data, error } = await context.db.rpc('create_gathering', {
    p_title: input.title,
    p_starts_at: input.starts_at,
    p_location: input.location ?? undefined,
  });
  if (error) throwFromDbError(error, context.logger);
  context.logger.info('gathering created');
  return { gathering: data as Gathering };
});

const gatheringsGet = appProcedure.gatherings.get.handler(async ({ input, context }) => {
  requireUser(context);
  const gathering = await run(context, () => getGathering(context.db, input.id));
  if (!gathering) {
    // invisible (stranger or blocked) and nonexistent are the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  const members = await run(context, () => listGatheringMembers(context.db, input.id));
  return { gathering, members };
});

const gatheringsJoin = appProcedure.gatherings.join.handler(async ({ input, context }) => {
  requireUser(context);
  const { error } = await context.db.rpc('join_gathering', { p_gathering_id: input.id });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

const gatheringsLeave = appProcedure.gatherings.leave.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  await run(context, () => leaveGathering(context.db, input.id, userId));
  return { ok: true as const };
});

const gatheringsListMine = appProcedure.gatherings.listMine.handler(async ({ context }) => {
  requireUser(context);
  const gatherings = await run(context, () => listMyGatherings(context.db));
  return { gatherings };
});

const gatheringsUpdate = appProcedure.gatherings.update.handler(async ({ input, context }) => {
  requireUser(context);
  const { id, ...patch } = input;
  const gathering = await run(context, () => updateGathering(context.db, id, patch));
  if (!gathering) {
    // not the host, or not visible at all: the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  return { gathering };
});

const gatheringsRemove = appProcedure.gatherings.remove.handler(async ({ input, context }) => {
  requireUser(context);
  await run(context, () => deleteGathering(context.db, input.id));
  return { ok: true as const };
});

const tagsListMine = appProcedure.tags.listMine.handler(async ({ context }) => {
  requireUser(context);
  const tags = await run(context, () => listOwnTags(context.db));
  return { tags: tags as Tag[] };
});

const tagsUpdate = appProcedure.tags.update.handler(async ({ input, context }) => {
  requireUser(context);
  const tag = await run(context, () =>
    updateOwnTagDestination(context.db, input.uid, input.destination),
  );
  if (!tag) {
    // not yours and nonexistent are the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  return { tag: tag as Tag };
});

export const appRouter = {
  profile: { get: getProfile, update: updateProfile },
  requests: {
    send: sendRequest,
    listPending: listPending,
    accept: acceptRequest,
    decline: declineRequest,
  },
  connections: { list: connectionsList, remove: connectionsRemove },
  blocks: { block, unblock, list: blocksList },
  gatherings: {
    create: gatheringsCreate,
    get: gatheringsGet,
    join: gatheringsJoin,
    leave: gatheringsLeave,
    listMine: gatheringsListMine,
    update: gatheringsUpdate,
    remove: gatheringsRemove,
  },
  tags: { listMine: tagsListMine, update: tagsUpdate },
};
