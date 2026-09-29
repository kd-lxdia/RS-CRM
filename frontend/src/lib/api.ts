import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from './endpoints';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    const { refreshToken, accessToken } = useAuthStore.getState();
    if (!refreshToken) return Promise.reject(new Error('Session expired'));
    refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, {
      timeout: 15000,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }).then(({ data }) => {
      // A response from an old session must not sign the user back in after logout.
      if (useAuthStore.getState().refreshToken !== refreshToken) {
        throw new Error('Session changed');
      }
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRequest = /\/auth\/(login|refresh|logout)(?:\?|$)/.test(originalRequest?.url || '');
    if (originalRequest && error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      const sessionToken = useAuthStore.getState().refreshToken;
      try {
        const currentAccessToken = useAuthStore.getState().accessToken;
        const requestToken = originalRequest.headers?.Authorization;
        const token = currentAccessToken && requestToken !== `Bearer ${currentAccessToken}`
          ? currentAccessToken
          : await refreshSession();
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        const expired = !sessionToken || (axios.isAxiosError(refreshError) &&
          [400, 401, 403].includes(refreshError.response?.status || 0));
        if (expired && useAuthStore.getState().refreshToken === sessionToken) {
          useAuthStore.getState().logout();
          if (window.location.pathname !== '/login') window.location.assign('/login');
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
