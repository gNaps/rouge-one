import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule, SidebarComponent, TopbarComponent, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.sass',
})
export class LayoutComponent {}
