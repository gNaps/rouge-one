import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectFormComponent } from '../../../@components/project/project-form/project-form.component';
import { TopbarComponent } from '../../../@components/ui/topbar/topbar.component';
import { ProjectStore } from '../../../@core/services/projects/project.store';
@Component({ selector: 'app-project-create', standalone: true, imports: [CommonModule, RouterLink, TopbarComponent, ProjectFormComponent], template: `<app-topbar [showDropDownProjects]="false" /><main class="ro-page"><div class="ro-header launch-heading"><div><a class="launch-back" routerLink="/">← All projects</a><p class="eyebrow">Launch sequence / New application</p><h1 class="ro-title">Create project</h1><p class="ro-subtitle">Connect your application in three steps.</p></div><span class="orbit-mark launch-mark" aria-hidden="true"><span></span></span></div><p class="ro-note" role="alert" *ngIf="error">{{error}}</p><div class="launch-layout"><aside class="launch-brief starfield"><p class="eyebrow">A new connection</p><h2>Expand your<br />universe.</h2><p>Every project is its own space. Give your application a home for identities, sign-in and access.</p><ol><li><span>01</span><div>Name your project<small>Define your application.</small></div></li><li><span>02</span><div>Choose your methods<small>Decide how people sign in.</small></div></li><li><span>03</span><div>Ready for launch<small>Review and connect.</small></div></li></ol><span class="orbit-mark" aria-hidden="true"><span></span></span></aside><app-project-form [saving]="busy" (save)="onSave($event)" /></div></main>` })
export class ProjectCreateComponent {
  store = inject(ProjectStore); router = inject(Router); busy = false; error = '';
  async onSave(input: any) {
    if (this.busy) return; this.busy = true; this.error = '';
    try { const project = await firstValueFrom(this.store.createProject(input)); await this.router.navigate(['/projects', project.id]); }
    catch (error: any) { this.error = error.error?.message || 'Unable to create project'; }
    finally { this.busy = false; }
  }
}
