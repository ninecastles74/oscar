export type ApiErrorBody = {
  success: false;
  error: string;
  details?: string;
  code?: string;
};

export type ApiSuccessBody<T> = { success: true } & T;

export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200): Response {
  return Response.json({ success: true, ...data } satisfies ApiSuccessBody<T>, { status });
}

export function jsonError(
  error: string,
  options?: { status?: number; details?: string; code?: string },
): Response {
  const status = options?.status ?? 400;
  const body: ApiErrorBody = {
    success: false,
    error,
    ...(options?.details ? { details: options.details } : {}),
    ...(options?.code ? { code: options.code } : {}),
  };
  return Response.json(body, { status });
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
