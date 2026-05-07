import axios from 'axios';

const MAX_NETWORK_RETRIES = 3;

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refresh_token: refresh,
        });
        localStorage.setItem('access_token', data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Retry on network errors (no response)
    const isNetworkError = !error.response;
    original._retryCount = original._retryCount ?? 0;
    if (isNetworkError && original._retryCount < MAX_NETWORK_RETRIES) {
      original._retryCount += 1;
      const delay = 2 ** original._retryCount * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(original);
    }

    return Promise.reject(error);
  }
);

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object') return JSON.stringify(detail);
  }
  return 'Erro desconhecido. Tente novamente.';
}
