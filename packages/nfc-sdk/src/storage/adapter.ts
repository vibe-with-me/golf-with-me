import type {
  CreateTagInput,
  ListScansFilter,
  ListTagsFilter,
  Scan,
  ScanInsert,
  Tag,
  UpdateTagInput,
} from '../types.js';

/**
 * Bring-your-own-storage contract. The SDK normalizes UIDs to uppercase before
 * calling any method, so implementations can assume uppercase UIDs.
 */
export interface StorageAdapter {
  getTagByUid(uid: string): Promise<Tag | null>;
  createTag(input: CreateTagInput): Promise<Tag>;
  updateTag(uid: string, patch: UpdateTagInput): Promise<Tag>;
  deactivateTag(uid: string): Promise<Tag>;
  listTags(filter?: ListTagsFilter): Promise<Tag[]>;
  insertScan(scan: ScanInsert): Promise<void>;
  listScans(filter: ListScansFilter): Promise<Scan[]>;
}
