import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../@core/services/auth.service';

@Component({
  selector: 'app-access', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="auth-shell">
      <aside class="auth-story starfield">
        <div class="auth-brand"><span class="orbit-mark" aria-hidden="true"><span></span></span>Rouge One</div>
        <p class="eyebrow">Identity, in your orbit</p>
        <p class="auth-headline">A universe<br />of possibilities.<br /><span>One identity.</span></p>
        <div class="universe-art" aria-hidden="true"><div class="orbit-track orbit-track-one"></div><div class="orbit-track orbit-track-two"></div><div class="orbit-track orbit-track-three"></div><div class="planet"></div><span class="satellite satellite-one"></span><span class="satellite satellite-two"></span><span class="cosmic-cross"></span></div>
        <span class="auth-story-note">Your space. Your people. Your rules.</span>
      </aside>
      <section class="auth-form-panel">
      <p class="eyebrow">{{ setup ? 'Begin your mission' : 'Administrator access' }}</p>
      <h1>{{ title }}</h1>
      <p *ngIf="setup && setupToken">Choose an email and password for your administrator account.</p>
      <p *ngIf="setup && !setupToken">Open the private setup link printed in your terminal after installation. If you need it again, run <code>pnpm run setup --config-only</code>.</p>
      <p role="alert" *ngIf="message || auth.connectionError()">{{ message || auth.connectionError() }}</p>
      <form *ngIf="!setup || setupToken" (ngSubmit)="submit()" #form="ngForm">
        <label *ngIf="!token || setup">Email<input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
        <label *ngIf="setup || action === 'sign-in' || action === 'reset' && token">Password<input name="password" type="password" [(ngModel)]="password" required [minlength]="action === 'sign-in' ? 1 : 12" maxlength="72" [autocomplete]="action === 'sign-in' ? 'current-password' : 'new-password'" /></label>
        <button type="submit" [disabled]="busy || form.invalid">{{ busy ? 'Please wait…' : button }}</button>
      </form>
      <ng-container *ngIf="action === 'sign-in' && !setup">
        <button *ngIf="methods.google" (click)="google()">Continue with Google</button>
        <p *ngIf="methods.magic_link"><a routerLink="/auth/email/magic">Sign in by email link</a></p>
        <p *ngIf="methods.email"><a routerLink="/auth/email/reset">Forgot password?</a> · <a routerLink="/auth/email/verify">Verify email</a></p>
      </ng-container>
      <p *ngIf="action !== 'sign-in' && !setup"><a routerLink="/auth/sign-in">Back to sign in</a></p>
      </section>
    </main>
    <footer class="auth-footer"><span>Rouge One / Identity systems</span><span>Self-hosted. Open source.</span></footer>`,
  styleUrl: './access.component.css',
})
export class AccessComponent {
  auth = inject(AuthService); route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  setup = false; action = 'sign-in'; token = ''; email = ''; password = ''; setupToken = ''; message = ''; busy = false;
  methods: any = {};
  get title() { return this.setup ? 'First-time setup' : this.action === 'sign-in' ? 'Administrator sign in' : this.action === 'magic' ? 'Email sign in' : this.action === 'verify' ? 'Verify your email' : 'Reset your password'; }
  get button() { return this.setup ? 'Create administrator' : this.action === 'sign-in' ? 'Sign in' : this.token ? this.action === 'magic' ? 'Continue' : 'Confirm' : 'Send email'; }
  async ngOnInit() {
    this.setup = this.route.snapshot.routeConfig?.path === 'setup';
    if (this.setup) {
      this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(fragment => {
        if (!fragment) return;
        this.setupToken = fragment;
        history.replaceState(history.state, '', location.pathname + location.search);
        this.message = '';
      });
    }
    this.action = this.route.snapshot.paramMap.get('action') || 'sign-in';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!['sign-in', 'magic', 'verify', 'reset'].includes(this.action)) { this.message = 'Unknown action'; return; }
    if (!this.auth.setupComplete() && !this.setup) { await this.auth.router.navigate(['/setup']); return; }
    if (this.setup && this.auth.setupComplete()) { await this.auth.router.navigate(['/auth/sign-in']); return; }
    if (this.token) history.replaceState(null, '', location.pathname);
    try { this.methods = await firstValueFrom(this.auth.http.get('/api/auth/methods')); } catch { this.message = 'Cannot load sign-in options.'; }
  }
  google() { location.assign('/api/auth/sign-in/google'); }
  async submit() {
    if (this.busy || this.setup && !this.setupToken) return;
    this.busy = true; this.message = '';
    try {
      let data: any;
      if (this.setup) {
        data = await firstValueFrom(this.auth.http.post('/api/setup', { email: this.email, password: this.password, token: this.setupToken }));
        this.setupToken = '';
        this.auth.setupComplete.set(true);
      } else if (this.action === 'sign-in') data = await firstValueFrom(this.auth.http.post('/api/auth/sign-in', { email: this.email, password: this.password }));
      else {
        const endpoint = this.token ? `/api/auth/email/${this.action}/consume` : this.action === 'magic' ? '/api/auth/sign-in/magic-link' : `/api/auth/email/${this.action}`;
        data = await firstValueFrom(this.auth.http.post(endpoint, this.token ? { token: this.token, ...(this.action === 'reset' ? { password: this.password } : {}) } : { email: this.email }));
        this.message = data.message;
      }
      if (data.user) { this.auth.accept(data); await this.auth.router.navigate(['/']); }
    } catch (error: any) {
      this.message = this.setup && error.status === 403 ? 'This setup link is invalid. Open the link printed by the setup command.' : error.error?.message || 'Request failed. Please try again.';
    }
    finally { this.busy = false; }
  }
}
