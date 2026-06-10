/** NTAG213 UIDs are 7 bytes = 14 hex chars. */
const UID_PATTERN = /^[0-9A-F]{14}$/;

export function normalizeUid(uid: string): string {
  return uid.trim().toUpperCase();
}

export function isValidUid(uid: string): boolean {
  return UID_PATTERN.test(normalizeUid(uid));
}
