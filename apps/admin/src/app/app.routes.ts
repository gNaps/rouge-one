import { Routes } from '@angular/router';
import { RecordsComponent } from './@pages/project/records/records.component';
import { AccessComponent } from './@pages/auth/access/access.component';
import { LayoutComponent } from './@components/ui/layout/layout.component';
import { AuthGuard } from './@core/guards/auth.guard';
import { AutoLoginGuard } from './@core/guards/auto-login.guard';
import { DashboardComponent } from './@pages/dashboard/dashboard.component';
import { ProjectCreateComponent } from './@pages/project/project-create/project-create.component';
import { ProjectDetailComponent } from './@pages/project/project-detail/project-detail.component';
import { ProjectPeopleComponent } from './@pages/project/project-people/project-people.component';
import { ProjectSettingsComponent } from './@pages/project/project-settings/project-settings.component';

export const routes: Routes = [
  { path: 'setup', component: AccessComponent },
  {
    path: 'auth',
    children: [
      {
        path: 'sign-up', redirectTo: 'sign-in', pathMatch: 'full',
      },
      {
        path: 'sign-in',
        component: AccessComponent,
        canActivate: [AutoLoginGuard],
      },
      {
        path: 'email/:action', component: AccessComponent,
      },
    ],
  },
  {
    path: '',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'create',
    component: ProjectCreateComponent, canActivate: [AuthGuard],
  },
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'projects',
        canActivate: [AuthGuard],
        children: [
          {
            path: ':id',
            component: ProjectDetailComponent,
            children: [
              {
                path: '',
                component: ProjectSettingsComponent,
                canActivate: [AuthGuard],
              },
              {
                path: 'people',
                component: ProjectPeopleComponent,
                canActivate: [AuthGuard],
              },
              {
                path: 'permissions',
                component: RecordsComponent, data: { resource: 'permissions' },
                canActivate: [AuthGuard],
              },
              {
                path: 'roles',
                component: RecordsComponent, data: { resource: 'roles' },
                canActivate: [AuthGuard],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
