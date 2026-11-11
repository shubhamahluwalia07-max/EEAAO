/**
 * Safe fetch JSON utility to prevent "Unexpected end of JSON input" crashes
 * on empty or non-JSON responses.
 */
export async function safeJson<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    return (text && text.trim().length > 0) ? (JSON.parse(text) as T) : null;
  } catch (err) {
    console.warn('safeJson parse warning:', err);
    return null;
  }
}

export async function parseResponseSafe<T = any>(res: Response): Promise<T | null> {
  return safeJson<T>(res);
}

export async function safeFetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  const res = await fetch(input, init);
  const data = await safeJson<T>(res);
  if (!res.ok) {
    const errorMsg = (data as any)?.detail || (data as any)?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
}
