/**
 * AuthScreen — holographic login/register/welcome UI.
 * Renders into a container div as an overlay above the arena.
 */

import { AuthService, type AuthUser } from "./AuthService";

type AuthView = "welcome" | "login" | "register" | "syncing";

export class AuthScreen {
  private container: HTMLElement;
  private auth = AuthService.get();
  onAuthenticated: (user: AuthUser) => void = () => {};
  onSkip: () => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show() {
    this.render("welcome");
  }

  showSyncing(message = "SYNCHRONIZING DEFENDER PROFILE...") {
    this.render("syncing", message);
  }

  hide() {
    this.container.innerHTML = "";
  }

  private render(view: AuthView, syncMsg?: string) {
    if (view === "syncing") {
      this.container.innerHTML = `
        <div class="auth-screen syncing-screen">
          <div class="auth-glyph pulse-glyph">◈</div>
          <h2 class="syncing-title">${syncMsg ?? "SYNCHRONIZING DEFENDER PROFILE..."}</h2>
          <div class="syncing-bar"><i class="syncing-fill"></i></div>
          <small class="syncing-sub">Establishing uplink with orbital network</small>
        </div>
      `;
      return;
    }

    if (view === "welcome") {
      this.container.innerHTML = `
        <div class="auth-screen welcome-screen">
          <div class="auth-header">
            <div class="auth-glyph">◈</div>
            <h1 class="auth-title">HOLOGRAM<span class="brand-light">DEFENDER</span></h1>
            <p class="auth-sub">ORBITAL DEFENSE NETWORK · SECTOR 07</p>
          </div>
          <div class="auth-welcome-body">
            <p class="auth-desc">Create an account to save your campaign progress, upgrades, and stats across all devices.</p>
            <div class="auth-buttons">
              <button class="primary auth-btn" id="auth-login-btn">COMMANDER LOGIN ↗</button>
              <button class="secondary auth-btn" id="auth-register-btn">CREATE ACCOUNT</button>
            </div>
            <button class="text-button auth-skip-btn" id="auth-skip-btn">
              Play without account (local save only)
            </button>
          </div>
        </div>
      `;
      this.container.querySelector("#auth-login-btn")!.addEventListener("click", () => this.render("login"));
      this.container.querySelector("#auth-register-btn")!.addEventListener("click", () => this.render("register"));
      this.container.querySelector("#auth-skip-btn")!.addEventListener("click", () => {
        this.hide();
        this.onSkip();
      });
      return;
    }

    if (view === "login") {
      this.container.innerHTML = `
        <div class="auth-screen login-screen">
          <div class="auth-header">
            <div class="auth-glyph">◈</div>
            <h2 class="auth-title">COMMANDER<span class="brand-light">LOGIN</span></h2>
            <p class="auth-sub">SECTOR 07 / IDENTITY VERIFICATION</p>
          </div>
          <form class="auth-form" id="auth-login-form" novalidate>
            <div class="auth-field">
              <label for="login-email">CALLSIGN EMAIL</label>
              <input id="login-email" type="email" autocomplete="email" placeholder="commander@sector07.net" required maxlength="254" />
            </div>
            <div class="auth-field">
              <label for="login-password">ACCESS CODE</label>
              <input id="login-password" type="password" autocomplete="current-password" placeholder="••••••••" required minlength="8" maxlength="128" />
            </div>
            <div class="auth-error" id="login-error" hidden></div>
            <button class="primary auth-btn" type="submit" id="login-submit">AUTHENTICATE ↗</button>
          </form>
          <div class="auth-switch">
            <span>No account?</span>
            <button class="text-button" id="switch-to-register">Register as new commander →</button>
          </div>
          <button class="text-button auth-back-btn" id="auth-back">← Back</button>
        </div>
      `;
      const form = this.container.querySelector<HTMLFormElement>("#auth-login-form")!;
      const errorEl = this.container.querySelector<HTMLElement>("#login-error")!;
      const submitBtn = this.container.querySelector<HTMLButtonElement>("#login-submit")!;
      this.container.querySelector("#switch-to-register")!.addEventListener("click", () => this.render("register"));
      this.container.querySelector("#auth-back")!.addEventListener("click", () => this.render("welcome"));

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = (this.container.querySelector("#login-email") as HTMLInputElement).value.trim();
        const password = (this.container.querySelector("#login-password") as HTMLInputElement).value;

        if (!email || !password) {
          this._showError(errorEl, "Please fill in all fields.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "AUTHENTICATING...";
        errorEl.hidden = true;

        try {
          const { user } = await this.auth.login(email, password);
          this.render("syncing");
          setTimeout(() => {
            this.hide();
            this.onAuthenticated(user);
          }, 1200);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Login failed";
          this._showError(errorEl, msg);
          submitBtn.disabled = false;
          submitBtn.textContent = "AUTHENTICATE ↗";
        }
      });
      return;
    }

    if (view === "register") {
      this.container.innerHTML = `
        <div class="auth-screen register-screen">
          <div class="auth-header">
            <div class="auth-glyph">◈</div>
            <h2 class="auth-title">NEW<span class="brand-light">COMMANDER</span></h2>
            <p class="auth-sub">SECTOR 07 / REGISTRATION</p>
          </div>
          <form class="auth-form" id="auth-register-form" novalidate>
            <div class="auth-field">
              <label for="reg-name">COMMANDER NAME</label>
              <input id="reg-name" type="text" autocomplete="name" placeholder="Cmdr. Hawking" required minlength="1" maxlength="32" />
            </div>
            <div class="auth-field">
              <label for="reg-email">CALLSIGN EMAIL</label>
              <input id="reg-email" type="email" autocomplete="email" placeholder="commander@sector07.net" required maxlength="254" />
            </div>
            <div class="auth-field">
              <label for="reg-password">ACCESS CODE <small>(min 8 characters)</small></label>
              <input id="reg-password" type="password" autocomplete="new-password" placeholder="••••••••" required minlength="8" maxlength="128" />
            </div>
            <div class="auth-error" id="reg-error" hidden></div>
            <button class="primary auth-btn" type="submit" id="reg-submit">REGISTER COMMANDER ↗</button>
          </form>
          <div class="auth-switch">
            <span>Already registered?</span>
            <button class="text-button" id="switch-to-login">Login to your account →</button>
          </div>
          <button class="text-button auth-back-btn" id="auth-back">← Back</button>
        </div>
      `;
      const form = this.container.querySelector<HTMLFormElement>("#auth-register-form")!;
      const errorEl = this.container.querySelector<HTMLElement>("#reg-error")!;
      const submitBtn = this.container.querySelector<HTMLButtonElement>("#reg-submit")!;
      this.container.querySelector("#switch-to-login")!.addEventListener("click", () => this.render("login"));
      this.container.querySelector("#auth-back")!.addEventListener("click", () => this.render("welcome"));

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = (this.container.querySelector("#reg-name") as HTMLInputElement).value.trim();
        const email = (this.container.querySelector("#reg-email") as HTMLInputElement).value.trim();
        const password = (this.container.querySelector("#reg-password") as HTMLInputElement).value;

        if (!name || !email || !password) {
          this._showError(errorEl, "Please fill in all fields.");
          return;
        }
        if (password.length < 8) {
          this._showError(errorEl, "Access code must be at least 8 characters.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "REGISTERING...";
        errorEl.hidden = true;

        try {
          const { user } = await this.auth.register(name, email, password);
          this.render("syncing");
          setTimeout(() => {
            this.hide();
            this.onAuthenticated(user);
          }, 1200);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Registration failed";
          this._showError(errorEl, msg);
          submitBtn.disabled = false;
          submitBtn.textContent = "REGISTER COMMANDER ↗";
        }
      });
      return;
    }
  }

  private _showError(el: HTMLElement, msg: string) {
    el.textContent = `⚠ ${msg}`;
    el.hidden = false;
  }
}
