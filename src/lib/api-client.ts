type ApiError = {
  success: false;
  error: string;
  details?: string;
  code?: string;
  quota?: import("@/features/analysis/quota-banner").QuotaInfo;
};

type ApiSuccess<T> = { success: true } & T;

export async function postJson<T>(url: string, body: unknown): Promise<ApiSuccess<T> | ApiError> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!res.ok && data && "success" in data && data.success === false) {
    return data;
  }
  if (!res.ok) {
    return {
      success: false,
      error: "Request failed",
      details: `HTTP ${res.status}`,
    };
  }
  return data;
}

export async function getJson<T>(url: string): Promise<ApiSuccess<T> | ApiError> {
  const res = await fetch(url);
  const data = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!res.ok && data && "success" in data && data.success === false) {
    return data;
  }
  if (!res.ok) {
    return {
      success: false,
      error: "Request failed",
      details: `HTTP ${res.status}`,
    };
  }
  return data;
}
