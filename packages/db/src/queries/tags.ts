import type { Db } from '../index.ts';
import type { Json } from '../types/supabase.ts';

const OWN_TAG_COLUMNS = 'uid, status, destination';

/**
 * The owner's view of a tag. tenant_id and claimed_by never leave the
 * database layer. destination is Json here (this package does not depend on
 * the contract); the tags_destination_shape CHECK is what makes the handler's
 * narrowing to the contract's Destination union safe.
 */
export interface OwnTagRow {
  uid: string;
  status: 'unclaimed' | 'claimed' | 'disabled';
  destination: Json | null;
}

/** Every tag the caller has claimed, including disabled ones. RLS: tags_select_own. */
export async function listOwnTags(db: Db): Promise<OwnTagRow[]> {
  const { data, error } = await db
    .from('tags')
    .select(OWN_TAG_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Re-point one of the caller's tags. RLS + the (destination, status) column
 * grant make this owner-only and the CHECK constraint validates the shape.
 * A tag that is not yours matches zero rows and reads as null.
 */
export async function updateOwnTagDestination(
  db: Db,
  uid: string,
  destination: Json,
): Promise<OwnTagRow | null> {
  const { data, error } = await db
    .from('tags')
    .update({ destination })
    .eq('uid', uid)
    .select(OWN_TAG_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}
