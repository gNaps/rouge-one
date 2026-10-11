import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { ApiResponse } from '../../models/api-response.model';
import { User } from '../../models/user.model';
import { ProjectStore } from '../projects/project.store';
import { UserApiService } from './user-api.service';

@Injectable({
  providedIn: 'root',
})
export class UserStore {
  userList = signal<ApiResponse<User>>({ data: [], total: 0 });
  user = signal<User | null>(null);
  loading = signal(false); error = signal('');
  private generation = 0; private projectCode = '';

  projectStore = inject(ProjectStore);
  userApi = inject(UserApiService);
  destroyRef = inject(DestroyRef);

  setPeopleList(data: ApiResponse<User>) {
    this.userList.set(data);
  }

  fetchPeople({ page, take, filter, sort }: any) {
    const code = this.projectStore.project()?.tenant_code ?? '';
    const generation = ++this.generation;
    if (this.projectCode !== code) { this.userList.set({ data: [], total: 0 }); this.projectCode = code; }
    this.loading.set(true); this.error.set('');
    this.userApi
      .findAll({
        projectCode: code,
        page,
        take,
        filter,
        sort,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((data) => {
          if (generation === this.generation) this.setPeopleList(data);
        }),
        catchError(error => { if (generation === this.generation) this.error.set(error.error?.message || 'Unable to load users'); return EMPTY; }),
        finalize(() => { if (generation === this.generation) this.loading.set(false); })
      )
      .subscribe();
  }

}
