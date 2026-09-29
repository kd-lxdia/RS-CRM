// A relative production URL avoids sending customer requests to a user's localhost.
const configuredUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
export const API_BASE_URL = configuredUrl || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api');
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, '') || window.location.origin;
