import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-project-card-social',
  standalone: true,
  imports: [],
  templateUrl: './project-card-social.component.html',
  styleUrl: './project-card-social.component.sass',
})
export class ProjectCardSocialComponent {
  @Input() project: any;
}
