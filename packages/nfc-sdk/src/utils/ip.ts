/**
 * SHA-256(ip + salt) as lowercase hex. The raw IP never leaves this function's scope.
 * Uses Web Crypto, available in Bun, Node 20+, and edge runtimes.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + salt));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
