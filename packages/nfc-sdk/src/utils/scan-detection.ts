import type { ScanMethod } from '../types.js';

export interface ScanDetectionHeaders {
  referer?: string | null;
  userAgent?: string | null;
}

const MOBILE_UA = /Mobile|Android|iPhone/i;

export function detectScanMethod(headers: ScanDetectionHeaders): ScanMethod {
  const referer = headers.referer?.trim() ?? '';
  const userAgent = headers.userAgent ?? '';

  if (!referer && MOBILE_UA.test(userAgent)) return 'nfc';
  const lowerReferer = referer.toLowerCase();
  if (lowerReferer.includes('camera') || lowerReferer.includes('qr')) return 'qr';
  if (!referer) return 'direct';
  return 'unknown';
}
