/** Names users sometimes paste into a secret value by mistake. */
const ENV_LINE_PREFIX =
  /^(?:GEMINI_API_KEY|GOOGLE_AI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GOOGLE_API_KEY|OPENAI_API_KEY|OPENAI_KEYS|ANTHROPIC_API_KEY)\s*=\s*(.+)$/i;

/** Google AI Studio keys always match this pattern. */
const GOOGLE_API_KEY_RE = /AIza[0-9A-Za-z_-]{30,}/;

/**
 * Normalize API secrets copied from .env files, dashboards, or chat.
 * Cloudflare rejects fetch when header/URL values contain newlines or control chars.
 */
export function sanitizeApiSecret(raw: string): string {
  let value = raw.replace(/^\uFEFF/, "").trim();
  value = value.replace(/^["'`]|["'`]$/g, "");

  const envLine = value.match(ENV_LINE_PREFIX);
  if (envLine?.[1]) value = envLine[1].trim();

  // Strip control characters and line breaks that break HTTP headers / URLs.
  value = value.replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, "");

  return value.trim();
}

/** Pull a valid Google AI key token out of messy pasted secret values. */
export function extractGoogleApiKey(raw: string): string | undefined {
  const cleaned = sanitizeApiSecret(raw);
  const match = cleaned.match(GOOGLE_API_KEY_RE);
  return match?.[0];
}

/** RFC 7230 — values must not contain CR/LF or other control characters. */
export function isValidHttpHeaderValue(value: string): boolean {
  if (!value) return false;
  return !/[\r\n]/.test(value) && /^[\t \x21-\x7E]+$/.test(value);
}

export function sanitizeApiSecretOrUndefined(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = sanitizeApiSecret(raw);
  if (!cleaned || !isValidHttpHeaderValue(cleaned)) return undefined;
  return cleaned;
}

export function sanitizeGoogleApiKeyOrUndefined(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const extracted = extractGoogleApiKey(raw);
  if (!extracted || !isValidHttpHeaderValue(extracted)) return undefined;
  return extracted;
}

export function describeGoogleKeyProblem(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return "GEMINI_API_KEY secret is missing or empty.";
  const extracted = extractGoogleApiKey(raw);
  if (extracted) return undefined;
  const preview = sanitizeApiSecret(raw).slice(0, 12);
  return (
    `GEMINI_API_KEY is set but no valid AIza… key was found (starts with "${preview || "?"}"). ` +
    "In Cloudflare Secrets, Value must be only the key from Google AI Studio — not GEMINI_API_KEY=…"
  );
}
