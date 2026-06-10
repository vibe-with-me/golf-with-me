import type { StorageAdapter } from './storage/adapter.js';
import type {
  CreateTagInput,
  ListScansFilter,
  ListTagsFilter,
  ResolveResult,
  Scan,
  ScanInput,
  ScanInsert,
  Tag,
  UpdateTagInput,
} from './types.js';
import { detectDeviceType } from './utils/device.js';
import { hashIp } from './utils/ip.js';
import { normalizeUid } from './utils/uid.js';

export interface NfcSdkOptions {
  storage: StorageAdapter;
  /** Salt mixed into SHA-256 IP hashing. Keep it secret and stable across deploys. */
  ipHashSalt: string;
}

export class NfcSdk {
  private readonly storage: StorageAdapter;
  private readonly ipHashSalt: string;

  constructor(opts: NfcSdkOptions) {
    this.storage = opts.storage;
    this.ipHashSalt = opts.ipHashSalt;
  }

  async resolve(uid: string): Promise<ResolveResult> {
    const normalized = normalizeUid(uid);
    const tag = await this.storage.getTagByUid(normalized);
    if (!tag) return { status: 'unclaimed', uid: normalized };
    if (!tag.is_active) return { status: 'inactive', tag };
    return { status: 'found', tag };
  }

  async logScan(input: ScanInput): Promise<void> {
    const scan: ScanInsert = {
      tag_id: input.tag_id,
      scan_method: input.scan_method ?? 'unknown',
      user_agent: input.user_agent ?? null,
      ip_hash: input.ip ? await hashIp(input.ip, this.ipHashSalt) : null,
      country: input.country ?? null,
      city: input.city ?? null,
      device_type: detectDeviceType(input.user_agent),
    };
    await this.storage.insertScan(scan);
  }

  createTag(input: CreateTagInput): Promise<Tag> {
    return this.storage.createTag({ ...input, nfc_uid: normalizeUid(input.nfc_uid) });
  }

  getTag(uid: string): Promise<Tag | null> {
    return this.storage.getTagByUid(normalizeUid(uid));
  }

  updateTag(uid: string, patch: UpdateTagInput): Promise<Tag> {
    return this.storage.updateTag(normalizeUid(uid), patch);
  }

  deactivateTag(uid: string): Promise<Tag> {
    return this.storage.deactivateTag(normalizeUid(uid));
  }

  listTags(filter?: ListTagsFilter): Promise<Tag[]> {
    return this.storage.listTags(filter);
  }

  listScans(filter: ListScansFilter): Promise<Scan[]> {
    return this.storage.listScans(filter);
  }
}
