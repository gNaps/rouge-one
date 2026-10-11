import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  currentTheme: 'dark' | 'light' = 'dark';
  constructor(@Inject(DOCUMENT) private document: Document) {}
  switchTheme(theme: 'dark' | 'light') {
    this.document.documentElement.classList.toggle('rouge-dark', theme === 'dark');
    this.currentTheme = theme;
  }
}
