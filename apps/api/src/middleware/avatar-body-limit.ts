import { AVATAR_MAX_BYTES } from '@withme/contract';

/**
 * The cap plus 64 KiB of multipart framing: an honest upload never comes near it.
 * Its own module, free of Worker types, so the Bun e2e can import the same number.
 */
export const AVATAR_BODY_LIMIT = AVATAR_MAX_BYTES + 65_536;
