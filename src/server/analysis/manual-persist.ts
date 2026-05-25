import type { ManualSubmission, UserAnalysisRequest } from "@/types/news-platform";
import { getFeedKv } from "../news/worker-env";
import {
  getRequest,
  getSubmission,
  saveRequest,
  saveSubmission,
  updateRequest,
  updateSubmission,
} from "./store";

const KV_PREFIX = "oscar:manual:v1:";
const TTL_SEC = 86_400;

async function kvPut(key: string, value: unknown): Promise<void> {
  const kv = getFeedKv();
  if (!kv) return;
  try {
    await kv.put(`${KV_PREFIX}${key}`, JSON.stringify(value), { expirationTtl: TTL_SEC });
  } catch (err) {
    console.warn("[manual-persist] KV put failed:", err instanceof Error ? err.message : err);
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = getFeedKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(`${KV_PREFIX}${key}`, "json");
    return raw && typeof raw === "object" ? (raw as T) : null;
  } catch {
    return null;
  }
}

export function persistManualRequest(request: UserAnalysisRequest): void {
  saveRequest(request);
  void kvPut(`req:${request.id}`, request);
}

export function persistManualSubmission(submission: ManualSubmission): void {
  saveSubmission(submission);
  void kvPut(`sub:${submission.id}`, submission);
}

export async function loadManualRequest(requestId: string): Promise<UserAnalysisRequest | undefined> {
  return getRequest(requestId) ?? (await kvGet<UserAnalysisRequest>(`req:${requestId}`)) ?? undefined;
}

export async function loadManualSubmission(
  submissionId: string,
): Promise<ManualSubmission | undefined> {
  return (
    getSubmission(submissionId) ?? (await kvGet<ManualSubmission>(`sub:${submissionId}`)) ?? undefined
  );
}

export function syncManualRequest(request: UserAnalysisRequest): void {
  updateRequest(request);
  void kvPut(`req:${request.id}`, request);
}

export function syncManualSubmission(submission: ManualSubmission): void {
  updateSubmission(submission);
  void kvPut(`sub:${submission.id}`, submission);
}
