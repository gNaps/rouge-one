import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  sidebarActive: boolean = false;
  toggleLayout$: Subject<boolean> = new Subject();

  toggleLayout() {
    this.toggleLayout$.next(this.sidebarActive);
    this.sidebarActive = !this.sidebarActive;
  }
}
