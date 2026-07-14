import { apiClient } from './client';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

describe('apiClient (envelope + auth contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('unwraps the success envelope and returns data directly (AGENTS.md rule 7)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { id: 'x' }, requestId: 'r1' }));

    const result = await apiClient.get('/products');

    expect(result).toEqual({ id: 'x' });
  });

  it('serializes params into the query string, skipping null/undefined', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [], requestId: 'r1' }));

    await apiClient.get('/customers', { params: { q: '98', skip: undefined, page: 2 } });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/customers?q=98&page=2');
    expect(url).not.toContain('skip');
  });

  it('throws a typed ApiError carrying code and requestId on failure envelopes', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'nope', details: null }, requestId: 'r9' }, 409),
    );

    await expect(apiClient.get('/sales')).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      requestId: 'r9',
      status: 409,
    });
  });

  it('on 401: refreshes, PERSISTS THE ROTATED refresh token, and retries (design 0010 lockstep)', async () => {
    localStorage.setItem('salesense_access_token', 'old-access');
    localStorage.setItem('salesense_refresh_token', 'rt-1');

    mockFetch
      // original request → 401
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { code: 'UNAUTHENTICATED', message: 'x', details: null }, requestId: 'r' }, 401))
      // refresh call → new pair (rotation!)
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { accessToken: 'new-access', refreshToken: 'rt-2' }, requestId: 'r' }))
      // retried original → success
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true }, requestId: 'r' }));

    const result = await apiClient.get('/sales');

    expect(result).toEqual({ ok: true });
    // the rotated token MUST replace the old one, or the next refresh would
    // replay a revoked token and burn the session family
    expect(localStorage.getItem('salesense_refresh_token')).toBe('rt-2');
    expect(localStorage.getItem('salesense_access_token')).toBe('new-access');
    // retry carried the fresh access token
    const retryHeaders = mockFetch.mock.calls[2][1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access');
  });
});
