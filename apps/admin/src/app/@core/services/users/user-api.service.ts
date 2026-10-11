import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../models/api-response.model';
import { Project } from '../../models/project.model';
import { User } from '../../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserApiService {
  http = inject(HttpClient);

  findAll({
    page,
    take,
    sort,
    projectCode, filter,
  }: any): Observable<ApiResponse<User>> {
    return this.http.get<any>(environment.apiUrl + `/people/${projectCode}`, {
      params: {
        page,
        take,
        ...(filter ? { email: filter } : {}),
        ...(sort && { sortField: sort.field, sortOrder: sort.order }),
      },
    });
  }

  findOne(id: number, projectCode: string): Observable<User> {
    return this.http.get<any>(
      environment.apiUrl + `/people/${projectCode}/${id}`
    );
  }

  create(user: Partial<User>, projectCode: string): Observable<Project> {
    return this.http.post<any>(
      environment.apiUrl + `/people/${projectCode}`,
      user
    );
  }

  update(userId: number, user: any, projectCode: string): Observable<Project> {
    return this.http.patch<any>(
      environment.apiUrl + `/people/${projectCode}/${userId}`,
      user
    );
  }

  delete(userId: number, projectCode: string): Observable<Project> {
    return this.http.delete<any>(
      environment.apiUrl + `/people/${projectCode}/${userId}`
    );
  }
}
