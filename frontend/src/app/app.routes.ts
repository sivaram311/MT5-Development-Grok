import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardLayoutComponent } from './dashboard/dashboard-layout.component';
import { AuthGuard } from './guards/auth.guard';
import { DASHBOARD_CHILDREN } from './dashboard.routes';

const dashboardShell = {
  component: DashboardLayoutComponent,
  canActivate: [AuthGuard],
  children: DASHBOARD_CHILDREN
};

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', ...dashboardShell },
  { path: 'welcome', ...dashboardShell },
  { path: '**', redirectTo: 'login' }
];
