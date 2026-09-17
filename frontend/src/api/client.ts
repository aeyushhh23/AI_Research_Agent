const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type AuthState = { token: string; user: { id: string; email: string } };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error ?? `Request failed: ${response.status}`);
  return data as T;
}

export const auth = {
  login: (email: string, password: string) =>
    api<AuthState>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    api<AuthState>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) })
};

export function researchStreamUrl(researchId: string) {
  const token = encodeURIComponent(localStorage.getItem("token") ?? "");
  return `${API_BASE}/api/research/${researchId}/stream?token=${token}`;
}
