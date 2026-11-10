/**
 * Sync protocol shared by the client engine, the in-memory reference server
 * and the Postgres functions in supabase/migrations.
 *
 * Push: a batch of idempotent upsert operations. For each op the server:
 *   1. returns the stored result if op_id was already applied (deduplication);
 *   2. inserts the row if it does not exist (version 1);
 *   3. applies it if base_version equals the server version (version + 1);
 *   4. otherwise resolves the conflict by last-writer-wins on client_updated_at:
 *        newer client  → applied, status "applied_lww", previous server row returned;
 *        older client  → not applied, status "conflict", current server row returned.
 * Pull: rows changed since a monotonically increasing server sequence cursor.
 */
import type { EntityTable } from "../domain/types";

export interface PushOp {
  op_id: string;
  table: EntityTable;
  row: Record<string, unknown>;
  base_version: number;
  client_updated_at: string;
}

export type PushStatus = "applied" | "applied_lww" | "conflict" | "rejected";

export interface PushResult {
  op_id: string;
  status: PushStatus;
  version?: number;
  /** For "conflict": the authoritative server row. For "applied_lww": the overwritten row. */
  row?: Record<string, unknown> | null;
  error?: string;
  /** True when this op_id had been applied before (a retried request). */
  duplicate?: boolean;
}

export interface PullChange {
  table: EntityTable;
  row: Record<string, unknown>;
  seq: number;
}

export interface PullResponse {
  changes: PullChange[];
  cursor: number;
  hasMore: boolean;
}

export interface SyncTransport {
  push(ops: PushOp[]): Promise<PushResult[]>;
  pull(cursor: number, limit: number): Promise<PullResponse>;
}

/** Columns the server owns; stripped before storing pulled rows locally. */
export const SERVER_COLUMNS = ["user_id", "server_seq", "server_updated_at"] as const;

export class TransportError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}
