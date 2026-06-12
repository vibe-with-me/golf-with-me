/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_DEMO_CREDENTIALS?: string;
  readonly VITE_GET_TAGS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Minimal ambient typing for the Cloudflare runtime module used in SSR.
// (Full @cloudflare/workers-types conflicts with the DOM lib this app needs.)
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
