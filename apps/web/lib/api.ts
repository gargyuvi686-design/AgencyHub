export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
}

export class ApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiException';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorData: ApiError = data?.error || {
      code: 'UNKNOWN_ERROR',
      message: response.statusText || 'An unexpected error occurred',
    };
    throw new ApiException(response.status, errorData);
  }

  return data;
}

export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { method: 'GET', ...options }),

  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  upload: <T>(url: string, body: FormData, options?: RequestInit) =>
    request<T>(url, { method: 'POST', body, ...options }),

  put: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { method: 'DELETE', ...options }),
};
