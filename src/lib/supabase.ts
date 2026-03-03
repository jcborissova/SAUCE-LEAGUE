import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REQUEST_TIMEOUT_MS = 15000;
const MAX_READ_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number): number => {
  const base = Math.min(1200, 180 * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 120);
  return base + jitter;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const createTimeoutSignal = (
  upstreamSignal?: AbortSignal
): {
  signal: AbortSignal;
  cleanup: () => void;
  wasUpstreamAbort: () => boolean;
} => {
  const controller = new AbortController();
  let abortedByUpstream = false;

  const onUpstreamAbort = () => {
    abortedByUpstream = true;
    controller.abort();
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      onUpstreamAbort();
    } else {
      upstreamSignal.addEventListener("abort", onUpstreamAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", onUpstreamAbort);
    },
    wasUpstreamAbort: () => abortedByUpstream,
  };
};

const supabaseFetch: typeof fetch = async (input, init) => {
  const templateRequest = input instanceof Request ? input : new Request(input, init);
  const method = templateRequest.method.toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  const maxAttempts = canRetry ? MAX_READ_RETRIES + 1 : 1;
  const upstreamSignal = init?.signal ?? templateRequest.signal;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeoutSignal = createTimeoutSignal(upstreamSignal);

    try {
      const request = new Request(templateRequest, { signal: timeoutSignal.signal });
      const response = await fetch(request);

      if (canRetry && attempt < maxAttempts && RETRYABLE_STATUS_CODES.has(response.status)) {
        await wait(getRetryDelay(attempt));
        continue;
      }

      return response;
    } catch (error) {
      const timedOut = isAbortError(error) && !timeoutSignal.wasUpstreamAbort();
      const retryableError = !isAbortError(error) || timedOut;
      const shouldRetry = canRetry && retryableError && attempt < maxAttempts;

      if (!shouldRetry) {
        throw error;
      }

      lastError = error;
      await wait(getRetryDelay(attempt));
    } finally {
      timeoutSignal.cleanup();
    }
  }

  throw (lastError as Error) ?? new Error("No se pudo completar la solicitud a Supabase.");
};

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en las variables de entorno.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: supabaseFetch,
  },
});
