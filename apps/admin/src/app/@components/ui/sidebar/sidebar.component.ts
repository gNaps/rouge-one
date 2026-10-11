import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  Renderer2,
  effect,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import { tap } from 'rxjs';
import { NavigationService } from '../../../@core/services/navigation.service';
import { ProjectStore } from '../../../@core/services/projects/project.store';
import { ThemeService } from '../../../@core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    RouterModule,
    SelectButtonModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.sass',
})
export class SidebarComponent {
  @Input() responsiveMode: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  projectId: number = 0;
  themeOptions: any[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  renderer = inject(Renderer2);
  themeService = inject(ThemeService);
  navigationService = inject(NavigationService);
  projectStore = inject(ProjectStore);

  themeControl: FormControl = new FormControl(this.themeService.currentTheme);

  constructor() {
    effect(() => {
      this.projectId = this.projectStore.projectId();
    });
  }

  ngOnInit(): void {
    this.themeControl.valueChanges
      .pipe(tap((theme) => this.themeService.switchTheme(theme)))
      .subscribe();
  }

  setTheme(theme: boolean) {
    this.themeControl.setValue(theme ? 'light' : 'dark');
  }

  getTheme() {
    return this.themeService.currentTheme;
  }

  onClose() {
    this.close.emit();
  }
}
