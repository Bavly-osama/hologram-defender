/**
 * AuthService — frontend client for the account system.
 * All auth state is stored in memory (never localStorage).
 * The session cookie is httpOnly and managed by the server.
 */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export type AuthState =
  | { status: "unknown" }
  | { status: "checking" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" };

type AuthStateListener = (state: AuthState) => void;

const API_BASE = "/api";

export class AuthService {
  private static _instance: AuthService | null = null;
  private _state: AuthState = { status: "unknown" };
  private _listeners: AuthStateListener[] = [];

  static get(): AuthService {
    if (!AuthService._instance) AuthService._instance = new AuthService();
    return AuthService._instance;
  }

  get state(): AuthState { return this._state; }

  get currentUser(): AuthUser | null {
    return this._state.status === "authenticated" ? this._state.user : null;
  }

  get isAuthenticated(): boolean {
    return this._state.status === "authenticated";
  }

  onChange(listener: AuthStateListener): () => void {
    this._listeners.push(listener);
    return () => { this._listeners = this._listeners.filter((l) => l !== listener); };
  }

  private _setState(s: AuthState) {
    this._state = s;
    this._listeners.forEach((l) => l(s));
  }

  /** Check session with server — called on app boot. */
  async checkSession(): Promise<AuthUser | null> {
    this._setState({ status: "checking" });
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text) as { user?: AuthUser };
          if (data.user) {
            this._setState({ status: "authenticated", user: data.user });
            return data.user;
          }
        }
      }
    } catch {
      // offline or server down — treat as unauthenticated to not block the game
    }
    this._setState({ status: "unauthenticated" });
    return null;
  }

  async register(name: string, email: string, password: string): Promise<{ user: AuthUser }> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      throw new Error("Unable to connect to orbital relay. Check connection.");
    }

    const text = await res.text();
    let data: any = {};
    try {
      if (text && text.trim()) data = JSON.parse(text);
    } catch {
      // ignore non-json body
    }

    if (!res.ok) {
      throw new Error(data.error ?? `Registration failed (Status ${res.status})`);
    }

    if (!data.user) {
      throw new Error("Invalid registration response from server");
    }

    this._setState({ status: "authenticated", user: data.user as AuthUser });
    return { user: data.user as AuthUser };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser }> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("Unable to connect to orbital relay. Check connection.");
    }

    const text = await res.text();
    let data: any = {};
    try {
      if (text && text.trim()) data = JSON.parse(text);
    } catch {
      // ignore non-json body
    }

    if (!res.ok) {
      throw new Error(data.error ?? `Login failed (Status ${res.status})`);
    }

    if (!data.user) {
      throw new Error("Invalid login response from server");
    }

    this._setState({ status: "authenticated", user: data.user as AuthUser });
    return { user: data.user as AuthUser };
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore network error on logout */ }
    this._setState({ status: "unauthenticated" });
  }

  /** Fetch the server-side player profile. */
  async fetchProfile(): Promise<import("../economy/StorageService").PlayerProfile | null> {
    try {
      const res = await fetch(`${API_BASE}/player/profile`, { credentials: "include" });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || !text.trim()) return null;
      const data = JSON.parse(text);
      return data.profile ?? null;
    } catch {
      return null;
    }
  }

  /** Push local profile to server for persistence. */
  async saveProfile(profile: import("../economy/StorageService").PlayerProfile): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/player/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Report level completion to server for authoritative unlock. */
  async reportLevelComplete(data: {
    levelId: number;
    score: number;
    coreIntegrity: number;
    accuracy: number;
    duration: number;
    creditsEarned: number;
  }): Promise<{ creditsGranted: number; nextUnlockedLevel: number; isPerfect: boolean } | null> {
    try {
      const res = await fetch(`${API_BASE}/progress/level-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || !text.trim()) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
