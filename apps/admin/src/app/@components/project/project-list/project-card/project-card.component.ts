import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProjectCardSocialComponent } from './project-card-social/project-card-social.component';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [ProjectCardSocialComponent],
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.sass',
})
export class ProjectCardComponent {
  @Input() project: any;
  @Output() openProject = new EventEmitter<number>();

  onOpenProject(id: number) {
    this.openProject.emit(id);
  }
}
