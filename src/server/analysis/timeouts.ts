import { getServerEnv } from "../env/server-env";

/** Shared timeout policy for OSCAR analysis (milliseconds). */
export const ANALYSIS_TIMEOUTS = {
  frontendAnalyzeMs: Number(getServerEnv("FRONTEND_ANALYZE_TIMEOUT_MS")) || 60_000,
  backendWallMs: Number(getServerEnv("MANUAL_ANALYSIS_WALL_MS")) || 90_000,
  geminiMs: Number(getServerEnv("GEMINI_FETCH_TIMEOUT_MS")) || 20_000,
  openAiMs: Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 30_000,
  anthropicMs: Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 30_000,
  evidenceClaimMs: Number(getServerEnv("LIVE_EVIDENCE_CLAIM_TIMEOUT_MS")) || 20_000,
  urlFetchMs: Number(getServerEnv("URL_FETCH_TIMEOUT_MS")) || 15_000,
  maxProviderRetries: Number(getServerEnv("LIVE_EVIDENCE_MAX_SINGLE_RETRIES")) || 2,
  claimConcurrency: Number(getServerEnv("MANUAL_MULTIMODEL_CONCURRENCY")) || 2,
  maxClaims: Number(getServerEnv("LIVE_EVIDENCE_MAX_CLAIMS")) || 5,
} as const;
