import type { ProblemDetails } from '../types/domain';

export interface ProblemResponseOptions {
  status: number;
  title: string;
  detail: string;
  code?: string;
  type?: string;
  instance?: string;
  suggested_alternatives?: string[];
  errors?: Record<string, string[]>;
}

/**
 * Creates a standard JSON HTTP Response with formatted payload and content-type headers.
 */
export function jsonResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

/**
 * Creates an RFC 7807 compliant problem details response with self-healing hints.
 */
export function problemResponse(options: ProblemResponseOptions): Response {
  const {
    status,
    code,
    title,
    detail,
    type = code
      ? `https://tripplanner.dev/errors/${code.toLowerCase().replace(/_/g, '-')}`
      : 'about:blank',
    instance,
    suggested_alternatives,
    errors,
  } = options;

  const payload: ProblemDetails = {
    type,
    title,
    status,
    detail,
    ...(instance ? { instance } : {}),
    ...(code ? { code } : {}),
    ...(suggested_alternatives && suggested_alternatives.length > 0
      ? { suggested_alternatives }
      : {}),
    ...(errors && Object.keys(errors).length > 0 ? { errors } : {}),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
    },
  });
}

/**
 * Extracts the requested view projection mode ('compact' | 'full') from a URL.
 * Defaults to 'full'.
 */
export function parseViewMode(url: URL | string): 'compact' | 'full' {
  const parsed = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  const view = parsed.searchParams.get('view')?.toLowerCase();
  return view === 'compact' ? 'compact' : 'full';
}

/**
 * Generates an alphanumeric identifier with an optional entity prefix.
 * e.g. "trip-a1b2c3d4e5f6", "stop-9x8y7z"
 */
export function generateId(prefix: string = 'id'): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).substring(2, 14);
  return `${prefix}-${randomPart}`;
}
