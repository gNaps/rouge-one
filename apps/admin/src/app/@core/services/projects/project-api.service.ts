import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../models/api-response.model';
import { Project } from '../../models/project.model';
import { environment } from '.././../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectApiService {
  http = inject(HttpClient);

  findAll(): Observable<ApiResponse<Project>> {
    return this.http.get<any>(environment.apiUrl + `/projects`);
  }

  findOne(id: number): Observable<Project> {
    return this.http.get<any>(environment.apiUrl + `/projects/${id}`);
  }

  create(project: any): Observable<Project> {
    return this.http.post<any>(environment.apiUrl + `/projects`, project);
  }

  update(projectId: number, project: any): Observable<Project> {
    return this.http.patch<any>(
      environment.apiUrl + `/projects/${projectId}`,
      project
    );
  }

  delete(projectId: number): Observable<Project> {
    return this.http.delete<any>(environment.apiUrl + `/projects/${projectId}`);
  }
}
