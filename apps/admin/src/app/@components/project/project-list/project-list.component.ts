import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProjectCardComponent } from './project-card/project-card.component';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [ProjectCardComponent],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.sass',
})
export class ProjectListComponent {
  @Input() projects: any[] = [];
  @Output() openProject = new EventEmitter<number>();

  onOpenProject(id: number) {
    this.openProject.emit(id);
  }
}
