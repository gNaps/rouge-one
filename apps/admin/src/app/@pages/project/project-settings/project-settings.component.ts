import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ProjectFormComponent } from '../../../@components/project/project-form/project-form.component';
import { ProjectStore } from '../../../@core/services/projects/project.store';
@Component({ selector: 'app-project-settings', standalone: true, imports: [CommonModule, ProjectFormComponent], template: `
  <p class="ro-note" *ngIf="store.loading()">Loading project…</p><p class="ro-note" role="alert" *ngIf="store.error() || message">{{store.error() || message}}</p>
  <ng-container *ngIf="store.project() as project">
    <div class="ro-stack">
      <section class="ro-panel"><div class="ro-header"><div><p class="eyebrow">Orbital systems / Application connection</p><h1 class="ro-title">{{project.name}}</h1></div><span class="ro-badge">Project settings</span></div><h2>Connect your application</h2>
        <p class="ro-hint">Use these URLs to connect your application, or try the working example.</p>
        <dl class="ro-details"><dt>Tenant code</dt><dd><code>{{project.tenant_code}}</code></dd><dt>Login URL</dt><dd><code>{{project.login_url}}</code></dd><dt>Application callback</dt><dd><code>{{project.redirect_url}}</code></dd><dt>Google callback</dt><dd><code>{{project.google_callback_url}}</code></dd></dl>
        <a class="ro-button" [href]="exampleUrl(project)" target="_blank" rel="noopener">Try login in the example application <i class="pi pi-external-link" aria-hidden="true"></i></a>
        <p class="ro-hint mt-4">Your application creates a PKCE verifier and state, opens the login URL, then exchanges the returned code. See the included example and integration guide.</p>
        <pre class="ro-code">{{snippet(project)}}</pre>
      </section>
      <app-project-form [project]="project" [saving]="busy" (save)="onSave($event)" />
    </div>
  </ng-container>` })
export class ProjectSettingsComponent {
  store = inject(ProjectStore); message = ''; busy = false;
  exampleUrl(p: any) { return `/example/?tenant=${encodeURIComponent(p.tenant_code)}`; }
  snippet(p: any) { return `POST /api/auth/${p.tenant_code}/token\n{ code, code_verifier, redirect_uri: ${JSON.stringify(p.redirect_url)} }`; }
  async onSave(input: any) {
    if (this.busy) return; this.busy = true; this.message = '';
    try { const p = await firstValueFrom(this.store.updateProject(this.store.projectId(), input)); this.store.setProject(p); this.message = 'Project saved'; }
    catch (error: any) { this.message = error.error?.message || 'Unable to save project'; }
    finally { this.busy = false; }
  }
}
