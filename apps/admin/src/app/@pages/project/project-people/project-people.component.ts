import { CommonModule, DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ProjectRole } from '@rouge-one/contracts';
import { AuthorizationApiService } from '../../../@core/services/authorization-api.service';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ApiResponse } from '../../../@core/models/api-response.model';
import { User } from '../../../@core/models/user.model';
import { ProjectStore } from '../../../@core/services/projects/project.store';
import { UserStore } from '../../../@core/services/users/user.store';

@Component({
  selector: 'app-project-people',
  standalone: true,
  imports: [
    TableModule,
    CommonModule,
    DatePipe,
  ],
  templateUrl: './project-people.component.html',
  styleUrl: './project-people.component.sass',
})
export class ProjectPeopleComponent {
  userStore = inject(UserStore);
  projectStore = inject(ProjectStore);
  authorization = inject(AuthorizationApiService); http = inject(HttpClient);
  roles: ProjectRole[] = []; rolesLoading = false; roleError = ''; roleNotice = ''; roleBusy = false; private rolesGeneration = 0;

  users = signal<ApiResponse<User>>({ data: [], total: 0 });

  page: number = 1;
  size: number = 10;
  filter: string = '';
  sort?: any;
  loading: boolean = false;

  constructor() {
    effect(() => {
      if (this.projectStore.project()) {
        void this.loadRoles(this.projectStore.project()!.tenant_code);
        this.userStore.fetchPeople({
          page: this.page,
          take: this.size,
          filter: this.filter,
          sort: this.sort,
        });
      }
    });
  }

  ngOnInit() {
    this.users = this.userStore.userList;
  }

  onChangePage(event: TableLazyLoadEvent) {
    this.page = Math.floor((event.first || 0) / (event.rows || this.size)) + 1;
    this.size = event.rows || this.size;

    if (event.sortField) {
      this.sort = {
        field: event.sortField,
        order: event.sortOrder || 0,
      };
    } else {
      this.sort = null;
    }

    if (this.projectStore.project()) {
      this.userStore.fetchPeople({
        page: this.page,
        take: this.size,
        filter: this.filter,
        sort: this.sort,
      });
    }
  }

  async loadRoles(code: string) {
    const generation = ++this.rolesGeneration;
    this.rolesLoading = true; this.roleError = ''; this.roleNotice = '';
    try { const roles = await this.authorization.catalog<ProjectRole>('roles', code); if (generation === this.rolesGeneration) this.roles = roles; }
    catch (error: any) { if (generation === this.rolesGeneration) this.roleError = error.error?.message || 'Unable to load roles'; }
    finally { if (generation === this.rolesGeneration) this.rolesLoading = false; }
  }
  async assignRole(user: any, roleId: number, selection: HTMLSelectElement) {
    if (this.roleBusy || roleId === user.role?.id) return;
    const code = this.projectStore.project()?.tenant_code;
    if (!code) return;
    this.roleBusy = true; this.roleError = ''; this.roleNotice = '';
    try {
      const result = await firstValueFrom(this.http.patch<{ role: { id: number; name: string } }>(`/api/people/${encodeURIComponent(code)}/${user.id}/role`, { role_id: roleId }));
      user.role = result.role;
      if (this.projectStore.project()?.tenant_code === code) {
        this.roleNotice = 'Role updated. This user must sign in again to receive the new access.';
        this.userStore.fetchPeople({ page: this.page, take: this.size, filter: this.filter, sort: this.sort });
      }
    } catch (error: any) { this.roleError = error.error?.message || 'Unable to update role'; }
    finally { this.roleBusy = false; selection.value = String(user.role?.id || ''); }
  }

  create() {}
  update(u: User) {}
  remove(u: User) {}
}
