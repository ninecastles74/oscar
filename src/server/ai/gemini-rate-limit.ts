import { getServerEnv } from "../env/server-env";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let queue: Promise<void> = Promise.resolve();

/** Serialize Gemini calls and enforce minimum spacing (free tier ~20 RPM). */
export async function withGeminiRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const minInterval = Number(getServerEnv("GEMINI_MIN_REQUEST_INTERVAL_MS")) || 4500;
  const run = async (): Promise<T> => {
    await sleep(minInterval);
    return fn();
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function parseRetryAfterSeconds(message: string): number | null {
  const m = message.match(/retry in ([\d.]+)s/i);
  if (!m) return null;
  return Math.min(60, Math.ceil(parseFloat(m[1]!) + 0.5));
}
