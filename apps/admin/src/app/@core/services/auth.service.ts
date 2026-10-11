import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';
import { KEY_STORAGE_USER, KEY_STORAGE_USER_JWT } from '../constant';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  setupComplete = signal(true);
  connectionError = signal('');
  csrfToken = '';
  http = inject(HttpClient);
  router = inject(Router);
  async initializeUser() {
    localStorage.removeItem(KEY_STORAGE_USER);
    localStorage.removeItem(KEY_STORAGE_USER_JWT);
    try {
      const setup = await firstValueFrom(this.http.get<{ complete: boolean }>('/api/setup/status'));
      this.setupComplete.set(setup.complete);
      if (setup.complete) {
        try { this.accept(await firstValueFrom(this.http.get<any>('/api/auth/me'))); }
        catch { this.clear(); }
      }
    } catch { this.connectionError.set('Cannot reach Rouge One. Check that the API is running.'); }
  }
  accept(data: any) { this.currentUser.set(data.user); this.csrfToken = data.csrfToken; }
  clear() { this.currentUser.set(null); this.csrfToken = ''; }
  async signOut() {
    try { await firstValueFrom(this.http.post('/api/auth/sign-out', {})); }
    catch (error: any) { if (error.status !== 401) throw error; }
    this.clear(); await this.router.navigate(['/auth/sign-in']);
  }
}
