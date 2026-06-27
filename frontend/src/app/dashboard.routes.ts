export const DASHBOARD_CHILDREN = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' as const },
  { path: 'overview', loadComponent: () => import('./dashboard/overview.component').then(m => m.OverviewComponent) },
  { path: 'market', loadComponent: () => import('./dashboard/market.component').then(m => m.MarketComponent) },
  { path: 'health', loadComponent: () => import('./dashboard/health.component').then(m => m.HealthComponent) },
  { path: 'volatility', loadComponent: () => import('./dashboard/volatility.component').then(m => m.VolatilityComponent) },
  { path: 'analysis', loadComponent: () => import('./dashboard/analysis.component').then(m => m.AnalysisComponent) },
  { path: 'docs', loadComponent: () => import('./dashboard/docs.component').then(m => m.DocsComponent) }
];
