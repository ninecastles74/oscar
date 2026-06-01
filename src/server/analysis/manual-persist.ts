import type { ManualSubmission, ReliabilityScoreBundle, UserAnalysisRequest } from "@/types/news-platform";
import { getFeedKv, isFeedKvConfigured } from "../news/worker-env";
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

export function isManualAnalysisKvConfigured(): boolean {
  return isFeedKvConfigured();
}

export async function persistManualRequest(request: UserAnalysisRequest): Promise<void> {
  saveRequest(request);
  await kvPut(`req:${request.id}`, request);
}

export async function persistManualSubmission(submission: ManualSubmission): Promise<void> {
  saveSubmission(submission);
  await kvPut(`sub:${submission.id}`, submission);
}

export async function loadManualRequest(requestId: string): Promise<UserAnalysisRequest | undefined> {
  const fromKv = await kvGet<UserAnalysisRequest>(`req:${requestId}`);
  if (fromKv) {
    saveRequest(fromKv);
    return fromKv;
  }
  return getRequest(requestId);
}

export async function loadManualSubmission(
  submissionId: string,
): Promise<ManualSubmission | undefined> {
  const fromKv = await kvGet<ManualSubmission>(`sub:${submissionId}`);
  if (fromKv) {
    saveSubmission(fromKv);
    return fromKv;
  }
  return getSubmission(submissionId);
}

export async function syncManualRequest(request: UserAnalysisRequest): Promise<void> {
  updateRequest(request);
  await kvPut(`req:${request.id}`, request);
}

export async function syncManualSubmission(submission: ManualSubmission): Promise<void> {
  updateSubmission(submission);
  await kvPut(`sub:${submission.id}`, submission);
}

export async function persistManualReliability(
  requestId: string,
  bundle: ReliabilityScoreBundle,
): Promise<void> {
  await kvPut(`rel:${requestId}`, bundle);
}

export async function loadManualReliability(
  requestId: string,
): Promise<ReliabilityScoreBundle | undefined> {
  const fromKv = await kvGet<ReliabilityScoreBundle>(`rel:${requestId}`);
  return fromKv ?? undefined;
}
