import { CommonModule } from '@angular/common';
import { Component, Input, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MenuModule } from 'primeng/menu';
import { DrawerModule } from 'primeng/drawer';
import { AuthService } from '../../../@core/services/auth.service';
import { ProjectStore } from '../../../@core/services/projects/project.store';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule,
    DrawerModule,
    SidebarComponent,
    SelectModule,
    MenuModule,
    ReactiveFormsModule,
    ButtonModule,
    RouterLink,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.sass',
})
export class TopbarComponent {
  @Input() showDropDownProjects = true;

  sidebarVisible = false;
  signoutError = '';
  selectedProject = new FormControl<any>(null);
  user: any;
  projects = signal<any[]>([]);

  authService = inject(AuthService);
  router = inject(Router);
  projectStore = inject(ProjectStore);

  items: MenuItem[] = [
    {
      label: 'logout',
    },
  ];

  constructor() {
    effect(
      () => {
        this.selectedProject.setValue(
          this.projects().find(
            (p) => Number(this.projectStore.projectId()) === p.id
          ),
          { emitEvent: false }
        );
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit() {
    this.user = this.authService.currentUser();
    this.projects = this.projectStore.projectList;

    if (!this.projects().length && this.showDropDownProjects) {
      this.projectStore.fetchProjects();
    }

    this.selectedProject.valueChanges.subscribe((project) => {
      window.location.href = `/projects/${project.id}`;
    });
  }

  async onSignout() {
    this.signoutError = '';
    try { await this.authService.signOut(); } catch { this.signoutError = 'Unable to sign out. Please try again.'; }
  }

  onCreateProject() {
    this.router.navigate(['/create']);
  }

  onClose() {
    this.sidebarVisible = false;
  }
}
