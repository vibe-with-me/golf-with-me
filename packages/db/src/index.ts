/**
 * The fixed default tenant for V1 single-tenant deployments.
 * Every table carries tenant_id with this value as its default — a dormant
 * seam so a future config layer can bolt on multi-tenancy without migration
 * pain. V1 never varies it and builds no tenant management around it.
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Deliverable step 3+ fills this in: Supabase client setup, generated types,
// and query helpers (consumed by apps/api only).
