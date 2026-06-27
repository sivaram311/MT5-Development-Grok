import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders sign-in form and branding', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Grok Dev' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue to dashboard/i })).toBeDisabled();
  });

  test('loads web manifest without 404', async ({ page, request }) => {
    const response = await request.get('/assets/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toContain('Grok Dev');
  });

  test('enables submit when credentials entered', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('secret');
    await expect(page.getByRole('button', { name: /Continue to dashboard/i })).toBeEnabled();
  });
});

test.describe('Auth guard', () => {
  test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
