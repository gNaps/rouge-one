import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AuthGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser;
  if (user()) {
    return true;
  } else {
    return router.createUrlTree([authService.setupComplete() ? '/auth/sign-in' : '/setup']);
  }
};
