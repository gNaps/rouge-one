import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthTokenInterceptor } from './@core/interceptors/auth-token.interceptor';
import { AuthService } from './@core/services/auth.service';
import { appInit } from './app-init';
import { routes } from './app.routes';

const Universe = definePreset(Aura, {
  semantic: {
    primary: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
    colorScheme: {
      light: {
        surface: { 0: '#ffffff', 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
        primary: { color: '#171717', inverseColor: '#ffffff', hoverColor: '#404040', activeColor: '#525252' },
        highlight: { background: '#e5e5e5', focusBackground: '#d4d4d4', color: '#171717', focusColor: '#171717' },
      },
      dark: {
        primary: { color: '#f5f5f5', inverseColor: '#0a0a0a', hoverColor: '#d4d4d4', activeColor: '#a3a3a3' },
        highlight: { background: '#262626', focusBackground: '#404040', color: '#ffffff', focusColor: '#ffffff' },
        surface: { 0: '#ffffff', 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#171717', 900: '#101010', 950: '#080808' },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({ theme: { preset: Universe, options: { darkModeSelector: '.rouge-dark' } } }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withInterceptors([AuthTokenInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: appInit,
      multi: true,
      deps: [AuthService],
    },
  ],
};
