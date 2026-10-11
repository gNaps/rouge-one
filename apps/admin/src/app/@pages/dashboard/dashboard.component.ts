import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProjectListComponent } from '../../@components/project/project-list/project-list.component';
import { TopbarComponent } from '../../@components/ui/topbar/topbar.component';
import { Project } from '../../@core/models/project.model';
import { ProjectStore } from '../../@core/services/projects/project.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TopbarComponent, CommonModule, ProjectListComponent, ButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.sass',
})
export class DashboardComponent {
  projectStore = inject(ProjectStore);
  router = inject(Router);

  projects = signal<Project[]>([]);

  ngOnInit() {
    this.projects = this.projectStore.projectList;
    this.projectStore.fetchProjects();
  }

  onOpenProject(id: number) {
    this.router.navigate(['/projects', id]);
  }

  onCreate() {
    this.router.navigate(['/create']);
  }
}
