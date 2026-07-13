export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details: unknown,
    public requestId: string | null,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions extends RequestInit {
  data?: unknown;
  params?: Record<string, string | number | boolean | undefined | null> | undefined;
}

class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

  private async fetchWithAuth(path: string, options: ApiOptions = {}): Promise<any> {
    const { data, headers: customHeaders, params, ...restOptions } = options;
    const token = typeof window !== 'undefined' ? localStorage.getItem('salesense_access_token') : null;
    const storeId = typeof window !== 'undefined' ? localStorage.getItem('salesense_active_store_id') : null;

    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type') && data && !(data instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (storeId) {
      headers.set('x-store-id', storeId);
    }

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          search.append(key, String(value));
        }
      }
      const queryString = search.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    const body = data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined;

    let response = await fetch(url, { ...restOptions, headers, ...(body !== undefined ? { body } : {}) });

    // Handle Token Refresh logic
    if (response.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('salesense_refresh_token');
      if (refreshToken && !path.includes('/auth/refresh')) {
        try {
          const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.data.accessToken) {
              localStorage.setItem('salesense_access_token', refreshData.data.accessToken);
              // Rotation (design doc 0010): the old refresh token is now
              // revoked — persist the new one or the next refresh would
              // replay a dead token and burn the whole session family.
              if (refreshData.data.refreshToken) {
                localStorage.setItem('salesense_refresh_token', refreshData.data.refreshToken);
              }
              // Retry the original request
              headers.set('Authorization', `Bearer ${refreshData.data.accessToken}`);
              response = await fetch(url, { ...restOptions, headers, ...(body !== undefined ? { body } : {}) });
            } else {
              this.clearAuthAndRedirect();
            }
          } else {
            this.clearAuthAndRedirect();
          }
        } catch (e) {
          this.clearAuthAndRedirect();
        }
      } else if (!path.includes('/auth/login') && !path.includes('/auth/register')) {
        this.clearAuthAndRedirect();
      }
    }

    let result;
    try {
      result = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError('INTERNAL_ERROR', response.statusText, null, null, response.status);
      }
      return null;
    }

    if (!response.ok || (result && result.success === false)) {
      throw new ApiError(
        result?.error?.code || 'INTERNAL_ERROR',
        result?.error?.message || response.statusText,
        result?.error?.details || null,
        result?.requestId || null,
        response.status
      );
    }

    // For list responses
    if (result.pagination) {
      return { data: result.data, pagination: result.pagination, requestId: result.requestId };
    }

    return result.data;
  }

  private clearAuthAndRedirect() {
    localStorage.removeItem('salesense_access_token');
    localStorage.removeItem('salesense_refresh_token');
    localStorage.removeItem('salesense_active_store_id');
    window.location.href = '/login';
  }

  get<T = any>(path: string, options?: ApiOptions): Promise<T> {
    return this.fetchWithAuth(path, { ...options, method: 'GET' }) as Promise<T>;
  }

  post<T = any>(path: string, data?: unknown, options?: ApiOptions): Promise<T> {
    return this.fetchWithAuth(path, { ...options, method: 'POST', data }) as Promise<T>;
  }

  patch<T = any>(path: string, data?: unknown, options?: ApiOptions): Promise<T> {
    return this.fetchWithAuth(path, { ...options, method: 'PATCH', data }) as Promise<T>;
  }

  delete<T = any>(path: string, options?: ApiOptions): Promise<T> {
    return this.fetchWithAuth(path, { ...options, method: 'DELETE' }) as Promise<T>;
  }
}

export const apiClient = new ApiClient();
