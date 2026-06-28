import { test, expect } from '@playwright/test';
import { seedAuthStorage } from './auth.helpers';

test.describe('Dashboard (authenticated shell)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthStorage(page);
    await page.route('**/api/auth/preferences', async route => {
      await route.fulfill({ json: { preferences: '{}' } });
    });
    await page.route('**/api/market/xauusd/health/stream*', async route => {
      await route.fulfill({ status: 204, body: '' });
    });
  });

  test('loads dashboard layout with bottom navigation', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.getByText('Grok Dev')).toBeVisible();
  });

  test('navigates to market route from bottom nav', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Market', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/market/);
  });
});
