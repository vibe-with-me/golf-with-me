import type { Db, Tables } from '../index.ts';

/** Same name as the contract's AVATARS_BUCKET (this package does not depend on the contract). */
const BUCKET = 'avatars';

/**
 * Every call here goes through `db`, the caller's own JWT client: Storage
 * RLS (per-user folders) is the boundary, never a service key.
 */
export async function uploadAvatarObject(
  db: Db,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
    // an hour bounds how long a removed photo can still be served from a CDN
    cacheControl: '3600',
  });
  if (error) throw error;
}

/** Deleting a path you do not own matches nothing (RLS), silently. */
export async function removeAvatarObjects(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

/** Up to 100 paths in the caller's own folder (the only folder they can list). */
export async function listOwnAvatarObjects(db: Db, userId: string): Promise<string[]> {
  const { data, error } = await db.storage.from(BUCKET).list(userId, { limit: 100 });
  if (error) throw error;
  return (data ?? []).map((entry) => `${userId}/${entry.name}`);
}

/** The CHECK rejects any path outside the caller's own folder. */
export async function setOwnAvatarPath(
  db: Db,
  userId: string,
  path: string | null,
): Promise<Tables<'profiles'>> {
  const { data, error } = await db
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
