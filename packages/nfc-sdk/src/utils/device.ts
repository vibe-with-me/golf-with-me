import type { DeviceType } from '../types.js';

const TABLET_UA = /iPad|Tablet|PlayBook|Silk|Kindle/i;
const MOBILE_UA = /Mobile|iPhone|iPod|Android|webOS|BlackBerry|Opera Mini|IEMobile/i;

export function detectDeviceType(userAgent: string | null | undefined): DeviceType | null {
  if (!userAgent) return null;
  if (TABLET_UA.test(userAgent)) return 'tablet';
  // Android tablets identify as Android without the "Mobile" token.
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet';
  if (MOBILE_UA.test(userAgent)) return 'mobile';
  return 'desktop';
}
