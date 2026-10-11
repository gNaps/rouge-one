import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, tap } from 'rxjs';
import { Project } from '../../models/project.model';
import { ProjectApiService } from './project-api.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectStore {
  projectId = signal<number>(0);
  projectList = signal<Project[]>([]);
  project = signal<Project | null>(null);
  loading = signal(false);
  error = signal('');

  projectApi = inject(ProjectApiService);
  destroyRef = inject(DestroyRef);

  setProjectId(id: number) {
    this.projectId.set(id);
  }

  setProjectList(list: Project[]) {
    this.projectList.set(list);
  }

  setProject(project: Project) {
    this.project.set(project);
  }

  fetchProjects() {
    this.loading.set(true); this.error.set('');
    this.projectApi
      .findAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(({ data, total }) => {
          this.setProjectList(data); this.loading.set(false);
        })
        ,catchError(error => { this.error.set(error.error?.message || 'Unable to load projects'); this.loading.set(false); return EMPTY; })
      )
      .subscribe();
  }

  fetchProject() {
    this.loading.set(true); this.error.set(''); this.project.set(null);
    this.projectApi
      .findOne(this.projectId())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((project) => {
          this.setProject(project); this.loading.set(false);
        })
        ,catchError(error => { this.error.set(error.error?.message || 'Unable to load projects'); this.loading.set(false); return EMPTY; })
      )
      .subscribe();
  }

  createProject(project: Partial<Project>) {
    return this.projectApi.create(project);
  }

  updateProject(projectId: number, project: Partial<Project>) {
    return this.projectApi.update(projectId, project);
  }
}
