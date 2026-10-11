import { avatarPublicUrl } from '@withme/contract';

/**
 * An avatar's URL, built from THIS client's configured Supabase URL: the
 * database stores only the path, so no stored value can point off-origin.
 * Null (the initial) rather than a throw when the env is missing: the
 * resolver renders cards and must stay unbreakable.
 */
export function avatarSrc(path: string | null): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return path && base ? avatarPublicUrl(base, path) : null;
}
