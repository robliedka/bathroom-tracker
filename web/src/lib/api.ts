import type {
  AdminUser,
  AuthResponse,
  BathroomReport,
  BathroomSummary,
  GamificationMe,
  LeaderboardResponse,
} from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "https://bathroom-tracker-cxepg7g5g7fjhkfk.westus2-01.azurewebsites.net";

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed?.message) {
          throw new Error(parsed.message);
        }
      } catch {
        // Not JSON.
      }
    }
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  register(payload: { name: string; email: string; password: string }) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me(token: string) {
    return request<{ name: string; email: string; roles: string[] }>(
      "/api/me",
      {},
      token,
    );
  },
  gamificationMe(token: string) {
    return request<GamificationMe>("/api/gamification/me", {}, token);
  },
  gamificationLeaderboard(token: string, take = 25) {
    return request<LeaderboardResponse>(
      `/api/gamification/leaderboard?take=${take}`,
      {},
      token,
    );
  },
  adminListUsers(token: string) {
    return request<AdminUser[]>("/api/admin/users", {}, token);
  },
  adminSetUserRole(token: string, userId: string, role: "standard" | "admin") {
    return request<void>(
      `/api/admin/users/${userId}`,
      { method: "PUT", body: JSON.stringify({ role }) },
      token,
    );
  },
  getBathrooms(token: string) {
    return request<BathroomSummary[]>("/api/bathrooms", {}, token);
  },
  createBathroom(token: string, payload: { name: string; location?: string }) {
    return request(
      "/api/bathrooms",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  deleteBathroom(token: string, bathroomId: string) {
    return request<void>(
      `/api/bathrooms/${bathroomId}`,
      { method: "DELETE" },
      token,
    );
  },
  report(
    token: string,
    bathroomId: string,
    payload: { status: "available" | "unavailable"; notes?: string },
  ) {
    return request<BathroomReport>(
      `/api/bathrooms/${bathroomId}/reports`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  getReports(token: string, bathroomId: string, hours = 24) {
    return request<BathroomReport[]>(
      `/api/bathrooms/${bathroomId}/reports?hours=${hours}`,
      {},
      token,
    );
  },
  subscribe(token: string, bathroomId: string) {
    return request<void>(
      `/api/bathrooms/${bathroomId}/subscribe`,
      { method: "POST" },
      token,
    );
  },
  unsubscribe(token: string, bathroomId: string) {
    return request<void>(
      `/api/bathrooms/${bathroomId}/subscribe`,
      { method: "DELETE" },
      token,
    );
  },
};
