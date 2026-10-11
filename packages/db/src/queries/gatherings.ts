import type { Db, Tables } from '../index.ts';
import { CARD_COLUMNS, type ProfileCard } from './handshake.ts';

/**
 * RLS does the scoping in every query here: a gathering you may not see (a
 * stranger's, or one whose host blocked you) reads as nonexistent.
 */
export async function getGathering(
  db: Db,
  gatheringId: string,
): Promise<Tables<'gatherings'> | null> {
  const { data, error } = await db
    .from('gatherings')
    .select('*')
    .eq('id', gatheringId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface GatheringMemberRow {
  joined_at: string;
  profile: ProfileCard;
}

/** Members with their cards. A member whose profile is hidden from the
 * viewer (blocked) drops out silently — absence carries no signal. */
export async function listGatheringMembers(
  db: Db,
  gatheringId: string,
): Promise<GatheringMemberRow[]> {
  const { data, error } = await db
    .from('gathering_members')
    .select(`joined_at, profile:profiles!gathering_members_profile_id_fkey(${CARD_COLUMNS})`)
    .eq('gathering_id', gatheringId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  // The generated type says profile is never null (NOT NULL FK); RLS on profiles makes it null for a hidden card.
  return (data ?? []).flatMap((row) =>
    row.profile ? [{ joined_at: row.joined_at, profile: row.profile }] : [],
  );
}

/** Every gathering the caller can see (host or member), in start-time order.
 * A bare select: RLS scopes it. */
export async function listMyGatherings(db: Db): Promise<Tables<'gatherings'>[]> {
  const { data, error } = await db
    .from('gatherings')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface GatheringPatch {
  title?: string;
  starts_at?: string;
  location?: string | null;
}

/** Host-only by RLS and the column grant: a non-host's patch matches zero
 * rows and reads as null. */
export async function updateGathering(
  db: Db,
  gatheringId: string,
  patch: GatheringPatch,
): Promise<Tables<'gatherings'> | null> {
  const { data, error } = await db
    .from('gatherings')
    .update(patch)
    .eq('id', gatheringId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Host-only by RLS; idempotent — a non-host's delete is a no-op.
 * Memberships cascade. */
export async function deleteGathering(db: Db, gatheringId: string): Promise<void> {
  const { error } = await db.from('gatherings').delete().eq('id', gatheringId);
  if (error) throw error;
}

/** Leaving is deleting your own membership row — idempotent under RLS. */
export async function leaveGathering(
  db: Db,
  gatheringId: string,
  userId: string,
): Promise<void> {
  const { error } = await db
    .from('gathering_members')
    .delete()
    .eq('gathering_id', gatheringId)
    .eq('profile_id', userId);
  if (error) throw error;
}
