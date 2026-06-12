/** Map technical API errors to plain language for end users. */
export function userFacingAnalysisError(error: string, details?: string, code?: string): string {
  if (code === "TIMEOUT" || error.includes("timed out")) {
    return "Analysis took too long and was stopped. Try a shorter article or paste the text directly.";
  }
  if (code === "LIVE_AI_REQUIRED" || error.includes("GEMINI")) {
    return "Live AI is not available right now. Check that GEMINI_API_KEY is set on the Worker and redeploy.";
  }
  if (code === "QUOTA_EXCEEDED") {
    return "You have reached your daily analysis limit. Try again tomorrow or upgrade your plan.";
  }
  if (code === "NOT_FOUND") {
    return "That article is not in the live feed yet. Visit Top 100 and wait for ingest to finish, then retry.";
  }
  if (code === "ANALYSIS_FAILED" || code === "LOAD_FAILED") {
    return details
      ? "Analysis could not be completed. Some live evidence may have been temporarily limited — try again in a minute."
      : "Analysis could not be completed. Please try again in a minute.";
  }
  if (code === "NETWORK_ERROR") {
    return "Could not reach the analysis server. Check your connection and retry.";
  }
  return error;
}
