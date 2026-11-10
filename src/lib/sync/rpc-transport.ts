/**
 * Transport that talks to the Postgres sync functions through any RPC caller
 * (Supabase client in the app, PGlite in tests).
 */
import type { PullResponse, PushOp, PushResult, SyncTransport } from "./protocol";
import { TransportError } from "./protocol";

export type RpcCaller = (fn: "soqqa_sync_push" | "soqqa_sync_pull", args: Record<string, unknown>) => Promise<unknown>;

export function rpcTransport(call: RpcCaller): SyncTransport {
  return {
    async push(ops: PushOp[]): Promise<PushResult[]> {
      const res = await call("soqqa_sync_push", { ops });
      if (!Array.isArray(res)) throw new TransportError("invalid push response");
      return res as PushResult[];
    },
    async pull(cursor: number, limit: number): Promise<PullResponse> {
      const res = (await call("soqqa_sync_pull", { since: cursor, max_rows: limit })) as PullResponse | null;
      if (!res || !Array.isArray(res.changes)) throw new TransportError("invalid pull response");
      return { changes: res.changes, cursor: Number(res.cursor), hasMore: !!res.hasMore };
    },
  };
}
