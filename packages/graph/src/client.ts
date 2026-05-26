import { getGraphAppToken } from "./auth";

export type GraphRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  retry?: {
    attempts?: number;
    baseDelayMs?: number;
  };
};

export class GraphRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseText: string,
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

const graphBaseUrl = "https://graph.microsoft.com/v1.0";

function graphUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("https://")) return pathOrUrl;
  return `${graphBaseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function graphRequest<T>(pathOrUrl: string, options: GraphRequestOptions = {}): Promise<T> {
  const attempts = options.retry?.attempts ?? 3;
  const baseDelayMs = options.retry?.baseDelayMs ?? 400;
  const accessToken = await getGraphAppToken();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(graphUrl(pathOrUrl), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    const responseText = await response.text();
    const retryAfter = Number(response.headers.get("retry-after"));
    const retryable = isRetryableStatus(response.status);
    lastError = new GraphRequestError(
      `Graph request failed: ${response.status} ${responseText}`,
      response.status,
      responseText,
      retryable
    );

    if (!retryable || attempt === attempts) break;
    await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * attempt);
  }

  throw lastError;
}

export function encodeGraphPathSegment(value: string): string {
  return encodeURIComponent(value).replace(/'/g, "%27");
}
