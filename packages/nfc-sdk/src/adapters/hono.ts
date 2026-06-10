import { Hono } from 'hono';
import type { NfcSdk } from '../sdk.js';
import type { Tag } from '../types.js';
import { detectScanMethod } from '../utils/scan-detection.js';
import { isValidUid, normalizeUid } from '../utils/uid.js';

export interface NfcRouterOptions {
  redirectStatus?: 301 | 302;
  unclaimedPage?: (uid: string) => string;
  inactivePage?: (tag: Tag) => string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function defaultPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}

export function nfcRouter(sdk: NfcSdk, options: NfcRouterOptions = {}): Hono {
  const app = new Hono();

  app.get('/t/:uid', async (c) => {
    const uid = normalizeUid(c.req.param('uid'));
    // Malformed UIDs never reach storage or the custom page callbacks.
    if (!isValidUid(uid)) {
      return c.html(defaultPage('Tag not recognized', 'This is not a valid tag.'), 404);
    }
    const result = await sdk.resolve(uid);

    if (result.status === 'unclaimed') {
      const html =
        options.unclaimedPage?.(uid) ??
        defaultPage('Tag not claimed', `No destination is configured for tag ${escapeHtml(uid)}.`);
      return c.html(html, 404);
    }

    if (result.status === 'inactive') {
      const html =
        options.inactivePage?.(result.tag) ??
        defaultPage('Tag inactive', 'This tag has been deactivated.');
      return c.html(html, 410);
    }

    const userAgent = c.req.header('user-agent') ?? null;
    const logPromise = sdk
      .logScan({
        tag_id: result.tag.id,
        scan_method: detectScanMethod({ referer: c.req.header('referer'), userAgent }),
        user_agent: userAgent,
        // cf-connecting-ip first: x-forwarded-for is client-spoofable on
        // deployments that aren't behind a trusted proxy.
        ip:
          c.req.header('cf-connecting-ip') ??
          c.req.header('x-real-ip') ??
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
          null,
        country: c.req.header('cf-ipcountry') ?? c.req.header('x-vercel-ip-country') ?? null,
        city: c.req.header('x-vercel-ip-city') ?? null,
      })
      .catch(() => {
        // Scan logging must never break the redirect.
      });

    let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
    try {
      // Accessing executionCtx throws outside of runtimes that provide one (e.g. Node).
      waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
    } catch {
      waitUntil = undefined;
    }
    if (waitUntil) {
      waitUntil(logPromise);
    } else {
      await logPromise;
    }

    return c.redirect(result.tag.destination_url, options.redirectStatus ?? 302);
  });

  return app;
}
