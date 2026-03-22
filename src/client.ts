import type { Profile, SessionAuth, SessionResponse, User, CachedUser } from "./types.js";
import { updateProfile } from "./config/store.js";

export class MetabaseClient {
  private domain: string;
  private sessionToken?: string;
  private apiKey?: string;
  private profile: Profile;

  constructor(profile: Profile) {
    this.profile = profile;
    this.domain = profile.domain.replace(/\/+$/, "");

    if (profile.auth.method === "session") {
      this.sessionToken = profile.auth.sessionToken;
    } else {
      this.apiKey = profile.auth.apiKey;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    } else if (this.sessionToken) {
      headers["X-Metabase-Session"] = this.sessionToken;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    let url = `${this.domain}${path}`;

    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.profile.auth.method === "session") {
      await this.login();
      const retryRes = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retryRes.ok) {
        const err = await retryRes.text();
        throw new Error(`${retryRes.status} ${retryRes.statusText}: ${err}`);
      }
      const retryText = await retryRes.text();
      if (!retryText) return undefined as T;
      return JSON.parse(retryText) as T;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${err}`);
    }

    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async requestFormExport(path: string, fields: Record<string, string>): Promise<Response> {
    const url = `${this.domain}${path}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    } else if (this.sessionToken) {
      headers["X-Metabase-Session"] = this.sessionToken;
    }

    const body = new URLSearchParams(fields);
    const res = await fetch(url, { method: "POST", headers, body });

    if (res.status === 401 && this.profile.auth.method === "session") {
      await this.login();
      if (this.sessionToken) {
        headers["X-Metabase-Session"] = this.sessionToken;
      }
      return fetch(url, { method: "POST", headers, body: new URLSearchParams(fields) });
    }

    return res;
  }

  async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.domain}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.profile.auth.method === "session") {
      await this.login();
      return fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    return res;
  }

  async login(): Promise<SessionResponse> {
    const auth = this.profile.auth as SessionAuth;
    const res = await fetch(`${this.domain}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: auth.email, password: auth.password }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Login failed: ${res.status} ${err}`);
    }

    const session = (await res.json()) as SessionResponse;
    this.sessionToken = session.id;

    // Cache session token in profile
    updateProfile(this.profile.name, {
      auth: { ...auth, sessionToken: session.id },
    });

    // Fetch and cache user info
    const user = await this.get<User>("/api/user/current");
    const cachedUser: CachedUser = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_superuser: user.is_superuser,
    };
    updateProfile(this.profile.name, { user: cachedUser });
    this.profile.user = cachedUser;

    return session;
  }

  async logout(): Promise<void> {
    await this.delete("/api/session");
    this.sessionToken = undefined;
    if (this.profile.auth.method === "session") {
      updateProfile(this.profile.name, {
        auth: { ...this.profile.auth, sessionToken: undefined },
      });
    }
  }

  async ensureAuthenticated(): Promise<void> {
    if (this.apiKey) return;
    if (!this.sessionToken) {
      await this.login();
    }
  }

  getProfile(): Profile {
    return this.profile;
  }

  getUserId(): number | null {
    return this.profile.user?.id ?? null;
  }
}
