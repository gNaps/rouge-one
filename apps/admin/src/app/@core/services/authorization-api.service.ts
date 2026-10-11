import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ProjectPermission, ProjectRole } from '@rouge-one/contracts';

@Injectable({ providedIn: 'root' })
export class AuthorizationApiService {
  http = inject(HttpClient);
  async catalog<T extends ProjectRole | ProjectPermission>(resource: 'roles' | 'permissions', code: string): Promise<T[]> {
    const data: T[] = [];
    for (let page = 1; ; page++) {
      const result = await firstValueFrom(this.http.get<{ data: T[]; total: number }>(`/api/${resource}/${encodeURIComponent(code)}`, { params: { page, take: 100 } }));
      data.push(...result.data);
      if (data.length >= result.total || !result.data.length) return data;
    }
  }
}
