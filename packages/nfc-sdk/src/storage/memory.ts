import type { StorageAdapter } from './adapter.js';
import type {
  CreateTagInput,
  ListScansFilter,
  ListTagsFilter,
  Scan,
  ScanInsert,
  Tag,
  UpdateTagInput,
} from '../types.js';

/** Non-persistent StorageAdapter for tests and examples. */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly tags = new Map<string, Tag>(); // keyed by nfc_uid
  private readonly scans: Scan[] = [];

  async getTagByUid(uid: string): Promise<Tag | null> {
    const tag = this.tags.get(uid);
    return tag ? structuredClone(tag) : null;
  }

  async createTag(input: CreateTagInput): Promise<Tag> {
    if (this.tags.has(input.nfc_uid)) {
      throw new Error(`Tag with nfc_uid ${input.nfc_uid} already exists`);
    }
    const now = new Date().toISOString();
    const tag: Tag = {
      id: crypto.randomUUID(),
      nfc_uid: input.nfc_uid,
      label: input.label ?? null,
      destination_url: input.destination_url,
      destination_type: input.destination_type ?? 'redirect',
      is_active: input.is_active ?? true,
      metadata: structuredClone(input.metadata ?? {}),
      created_at: now,
      updated_at: now,
    };
    this.tags.set(tag.nfc_uid, tag);
    return structuredClone(tag);
  }

  async updateTag(uid: string, patch: UpdateTagInput): Promise<Tag> {
    const tag = this.tags.get(uid);
    if (!tag) {
      throw new Error(`Tag with nfc_uid ${uid} not found`);
    }
    const updated: Tag = {
      ...tag,
      ...structuredClone(patch),
      updated_at: new Date().toISOString(),
    };
    this.tags.set(uid, updated);
    return structuredClone(updated);
  }

  deactivateTag(uid: string): Promise<Tag> {
    return this.updateTag(uid, { is_active: false });
  }

  async listTags(filter: ListTagsFilter = {}): Promise<Tag[]> {
    let tags = [...this.tags.values()];
    if (filter.is_active !== undefined) {
      tags = tags.filter((tag) => tag.is_active === filter.is_active);
    }
    if (filter.limit !== undefined) {
      tags = tags.slice(0, filter.limit);
    }
    return structuredClone(tags);
  }

  async insertScan(scan: ScanInsert): Promise<void> {
    this.scans.push({
      id: crypto.randomUUID(),
      ...structuredClone(scan),
      scanned_at: new Date().toISOString(),
    });
  }

  async listScans(filter: ListScansFilter): Promise<Scan[]> {
    let scans = this.scans.filter(
      (scan) =>
        (filter.tag_id === undefined || scan.tag_id === filter.tag_id) &&
        (filter.since === undefined || scan.scanned_at >= filter.since) &&
        (filter.until === undefined || scan.scanned_at <= filter.until),
    );
    scans = scans.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
    if (filter.limit !== undefined) {
      scans = scans.slice(0, filter.limit);
    }
    return structuredClone(scans);
  }
}
