import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const AuthTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  if (!request.url.startsWith('/api/')) return next(request);
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(request.clone({ withCredentials: true, ...(write && auth.csrfToken ? { setHeaders: { 'X-CSRF-Token': auth.csrfToken } } : {}) })).pipe(catchError(error => {
    if (error.status === 401 && auth.currentUser()) { auth.clear(); void auth.router.navigate(['/auth/sign-in']); }
    return throwError(() => error);
  }));
};
