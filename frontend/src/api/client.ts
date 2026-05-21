import { z } from 'zod';
import { ApiError, ApiErrorBody } from './types';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8080/api')
});

const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
});

export const API_BASE_URL = env.VITE_API_BASE_URL.replace(/\/$/, '');
const TOKEN_KEY = 'smart-home-token';
export const AUTH_EXPIRED_EVENT = 'smart-home-auth-expired';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function notifyAuthExpired() {
  clearToken();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

function toQuery(params?: Record<string, string | number | boolean | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function apiClient<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined | null> } = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}${toQuery(options.params)}`, {
    ...options,
    headers
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const body = payload as ApiErrorBody;
    if (response.status === 401) {
      notifyAuthExpired();
    }
    throw new ApiError(response.status, body.message || body.error || response.statusText, body.error);
  }

  return payload as T;
}
