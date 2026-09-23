import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

/** Service-role client: test setup only (provisioning tags), never the path under test. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export function freshUid(): string {
  let uid = '';
  for (let i = 0; i < 14; i++) {
    uid += '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
  }
  return uid;
}

/** Drives the login page's sign-up form. Local Supabase has confirmations off. */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('smoke-pass-1!');
  await page.getByRole('button', { name: 'Sign up' }).click();
}

/** The `returnTo` search param of the current URL, decoded. */
export function returnToOf(page: Page): string | null {
  return new URL(page.url()).searchParams.get('returnTo');
}
