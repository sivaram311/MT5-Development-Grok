import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardLayoutComponent } from './dashboard/dashboard-layout.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'welcome', 
    component: DashboardLayoutComponent, 
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', loadComponent: () => import('./dashboard/overview.component').then(m => m.OverviewComponent) },
      { path: 'market', loadComponent: () => import('./dashboard/market.component').then(m => m.MarketComponent) },
      { path: 'health', loadComponent: () => import('./dashboard/health.component').then(m => m.HealthComponent) },
      { path: 'analysis', loadComponent: () => import('./dashboard/analysis.component').then(m => m.AnalysisComponent) }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
