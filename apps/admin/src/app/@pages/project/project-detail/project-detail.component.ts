import { Component, Input, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProjectStore } from '../../../@core/services/projects/project.store';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.sass',
})
export class ProjectDetailComponent {
  @Input() id: number = 0;

  projectStore = inject(ProjectStore);

  ngOnInit(): void {
    this.projectStore.setProjectId(Number(this.id));
    this.projectStore.fetchProject();
  }
}
