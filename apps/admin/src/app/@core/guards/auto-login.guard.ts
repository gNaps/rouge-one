import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AutoLoginGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser;
  if (user()) {
    return router.createUrlTree(['/']);
  } else {
    return true;
  }
};
