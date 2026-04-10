const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const apiFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const normalizedInput =
    API_BASE_URL && typeof input === 'string' && input.startsWith('/')
      ? `${API_BASE_URL}${input}`
      : input;

  return fetch(normalizedInput, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.headers || {})
    }
  });
};
