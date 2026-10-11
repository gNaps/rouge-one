import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ProjectPermission, ProjectRole } from '@rouge-one/contracts';
import { ProjectStore } from '../../../@core/services/projects/project.store';
import { AuthorizationApiService } from '../../../@core/services/authorization-api.service';

@Component({ standalone: true, imports: [CommonModule, FormsModule], templateUrl: './records.component.html' })
export class RecordsComponent {
  store = inject(ProjectStore); http = inject(HttpClient); route = inject(ActivatedRoute); api = inject(AuthorizationApiService);
  resource: 'roles' | 'permissions' = this.route.snapshot.data['resource'];
  roles: ProjectRole[] = []; permissions: ProjectPermission[] = [];
  error = ''; notice = ''; loading = false; busy = false; editorOpen = false;
  editingId: number | null = null; name = ''; isDefault = false; originalDefault = false; selectedIds = new Set<number>(); search = '';
  private generation = 0; private editorCode = ''; private catalogCode = '';
  constructor() {
    effect(() => { const project = this.store.project(); if (project) { this.editorOpen = false; this.search = ''; this.notice = ''; void this.load(project.tenant_code); } });
  }
  get filteredRoles() { return this.roles.filter(role => role.name.toLowerCase().includes(this.search.toLowerCase())); }
  get filteredPermissions() { return this.permissions.filter(permission => permission.name.toLowerCase().includes(this.search.toLowerCase())); }
  async load(code = this.store.project()?.tenant_code) {
    if (!code) return;
    const generation = ++this.generation;
    if (this.catalogCode !== code) { this.roles = []; this.permissions = []; this.catalogCode = code; }
    this.loading = true; this.error = '';
    try {
      const [roles, permissions] = await Promise.all([this.api.catalog<ProjectRole>('roles', code), this.api.catalog<ProjectPermission>('permissions', code)]);
      if (generation === this.generation) { this.roles = roles; this.permissions = permissions; }
    } catch (error: any) { if (generation === this.generation) this.error = error.error?.message || 'Unable to load access settings'; }
    finally { if (generation === this.generation) this.loading = false; }
  }
  edit(record?: ProjectRole | ProjectPermission) {
    this.editingId = record?.id || null; this.name = record?.name || '';
    this.originalDefault = this.resource === 'roles' && !!(record as ProjectRole)?.is_default;
    this.isDefault = this.originalDefault;
    this.selectedIds = new Set(this.resource === 'roles' ? (record as ProjectRole)?.permissions.map(permission => permission.id) || [] : []);
    this.editorCode = this.store.project()?.tenant_code || ''; this.editorOpen = true; this.error = ''; this.notice = '';
  }
  togglePermission(id: number, checked: boolean) { if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id); }
  async save() {
    if (this.busy || !this.name.trim() || this.editorCode !== this.store.project()?.tenant_code) return;
    this.busy = true; this.error = ''; this.notice = '';
    const payload = { name: this.name.trim(), ...(this.resource === 'roles' ? { is_default: this.isDefault, permission_ids: [...this.selectedIds] } : {}) };
    const path = `/api/${this.resource}/${encodeURIComponent(this.editorCode)}`;
    try {
      await firstValueFrom(this.editingId ? this.http.patch(`${path}/${this.editingId}`, payload) : this.http.post(path, payload));
      this.editorOpen = false; this.notice = this.resource === 'roles' ? 'Role saved. Users whose access changed must sign in again.' : 'Permission saved.';
      await this.load();
    } catch (error: any) { this.error = error.error?.message || 'Unable to save'; }
    finally { this.busy = false; }
  }
  async makeDefault(role: ProjectRole) {
    if (this.busy) return;
    this.busy = true; this.error = '';
    const code = this.store.project()?.tenant_code;
    try { await firstValueFrom(this.http.patch(`/api/roles/${encodeURIComponent(code || '')}/${role.id}`, { is_default: true })); this.notice = 'Default role updated. Existing users keep their assigned role.'; await this.load(); }
    catch (error: any) { this.error = error.error?.message || 'Unable to change the default role'; }
    finally { this.busy = false; }
  }
  async remove(record: ProjectRole | ProjectPermission) {
    if (this.busy || !confirm(`Delete ${this.resource === 'roles' ? 'role' : 'permission'} “${record.name}”?${this.resource === 'permissions' ? ' It will be removed from every role. Affected users must sign in again.' : ''}`)) return;
    this.busy = true; this.error = ''; this.notice = '';
    const code = this.store.project()?.tenant_code;
    try { await firstValueFrom(this.http.delete(`/api/${this.resource}/${encodeURIComponent(code || '')}/${record.id}`)); this.editorOpen = false; this.notice = 'Deleted successfully.'; await this.load(); }
    catch (error: any) { this.error = error.error?.message || 'Unable to delete'; }
    finally { this.busy = false; }
  }
}
