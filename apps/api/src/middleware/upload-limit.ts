import { AVATAR_MAX_BYTES } from '@withme/contract';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { HonoEnv } from '../env.ts';

/** RPCHandler prefix '/rpc' + the router path app.profile.uploadAvatar. */
const UPLOAD_PATH = '/rpc/app/profile/uploadAvatar';

/** The cap plus 64 KiB of multipart framing: an honest upload never comes near it. */
export const AVATAR_BODY_LIMIT = AVATAR_MAX_BYTES + 65_536;

const limit = bodyLimit({
  maxSize: AVATAR_BODY_LIMIT,
  onError: (c) => c.json({ error: 'payload too large' }, 413),
});

/**
 * 413 before oRPC buffers the body: RPCHandler reads the whole multipart body
 * before the contract's z.file().max() can run, so the size is judged here.
 * Hono's bodyLimit refuses a declared Content-Length over the limit without
 * reading; with no length (a chunked upload, which React Native may send) it
 * counts the streamed bytes and stops at the limit. Mounted on /rpc/* because
 * oRPC also serves the path with a trailing slash.
 */
export function avatarUploadLimit(): MiddlewareHandler<HonoEnv> {
  return (c, next) => (c.req.path.replace(/\/$/, '') === UPLOAD_PATH ? limit(c, next) : next());
}
