import { avatarPublicUrl } from '@withme/contract';

// Static access, so Expo inlines it at bundle time.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

/**
 * An avatar's URL from THIS app's configured Supabase URL; the database
 * stores only the path. Null (the initial) when unset, never a throw.
 */
export function avatarSrc(path: string | null): string | null {
  return path && supabaseUrl ? avatarPublicUrl(supabaseUrl, path) : null;
}
