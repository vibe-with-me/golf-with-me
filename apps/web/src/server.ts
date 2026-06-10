import handler from '@tanstack/react-start/server-entry';

/**
 * Wraps the Start server entry to stamp security headers on every response.
 * A full CSP needs nonce plumbing for Start's hydration scripts, so V1 ships
 * frame-ancestors (the clickjacking guard for the one-tap Connect card) and
 * the safe baseline set.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// The Workers runtime passes (request, env, ctx); Start's published type is
// narrower, so the tail is spread through untyped. fetch must be invoked ON
// the handler object — a detached reference loses `this` and breaks
// streamed document responses.
type WorkersFetch = (request: Request, ...rest: unknown[]) => Promise<Response>;

export default {
  async fetch(request: Request, ...rest: unknown[]): Promise<Response> {
    const upstream = await (handler.fetch as WorkersFetch).call(handler, request, ...rest);
    const response = new Response(upstream.body, upstream);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }
    return response;
  },
};
