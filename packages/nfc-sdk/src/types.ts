export type ScanMethod = 'nfc' | 'qr' | 'direct' | 'unknown';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface Tag {
  id: string;
  nfc_uid: string;
  label: string | null;
  destination_url: string;
  destination_type: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTagInput {
  nfc_uid: string;
  destination_url: string;
  label?: string | null;
  destination_type?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateTagInput {
  label?: string | null;
  destination_url?: string;
  destination_type?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ListTagsFilter {
  is_active?: boolean;
  limit?: number;
}

export interface Scan {
  id: string;
  tag_id: string;
  scan_method: ScanMethod;
  user_agent: string | null;
  ip_hash: string | null;
  country: string | null;
  city: string | null;
  device_type: DeviceType | null;
  scanned_at: string;
}

/** The record handed to storage. ip_hash is already hashed; the raw IP never reaches storage. */
export interface ScanInsert {
  tag_id: string;
  scan_method: ScanMethod;
  user_agent: string | null;
  ip_hash: string | null;
  country: string | null;
  city: string | null;
  device_type: DeviceType | null;
}

export interface ScanInput {
  tag_id: string;
  scan_method?: ScanMethod;
  user_agent?: string | null;
  /** Raw client IP. Hashed (SHA-256 + salt) before storage; never stored or returned raw. */
  ip?: string | null;
  /** Caller-supplied, e.g. from edge headers like cf-ipcountry. */
  country?: string | null;
  city?: string | null;
}

export interface ListScansFilter {
  tag_id?: string;
  /** ISO timestamp lower bound (inclusive) on scanned_at. */
  since?: string;
  /** ISO timestamp upper bound (inclusive) on scanned_at. */
  until?: string;
  limit?: number;
}

export type ResolveResult =
  | { status: 'found'; tag: Tag }
  | { status: 'unclaimed'; uid: string }
  | { status: 'inactive'; tag: Tag };
