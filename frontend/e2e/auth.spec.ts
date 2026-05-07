import { test, expect } from '@playwright/test';

// Override the project-level storageState — every test in this file must start
// without any cookies or localStorage so we can test the auth flow itself.
test.use({ storageState: { cookies: [], origins: [] } });

test('login with valid credentials redirects to /:username', async ({ page }) => {
  await page.goto('/Login');
  await page.locator('input[type="text"]').fill(process.env.TEST_USER_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  // LogIn.tsx navigates to /${data.user.username} on success.
  await expect(page).toHaveURL(new RegExp(`/${process.env.TEST_USERNAME}$`));
});

test('login with wrong password shows an error message', async ({ page }) => {
  await page.goto('/Login');
  await page.locator('input[type="text"]').fill(process.env.TEST_USER_EMAIL!);
  await page.locator('input[type="password"]').fill('wrong_password_xyz_99');
  await page.getByRole('button', { name: 'Login' }).click();
  // LogIn.tsx renders: {error && <p className="text-red-500 text-sm">{error}</p>}
  await expect(page.locator('p.text-red-500')).toBeVisible();
});

test('unauthenticated visit to / shows public feed without redirect', async ({ page }) => {
  await page.goto('/');
  // Guests can browse the feed — no redirect to /Login.
  await expect(page).toHaveURL('/');
  // GuestNav is visible with Sign In and Create Account links.
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible({ timeout: 10_000 });
});

test('unauthenticated visit to /settings redirects to /Login', async ({ page }) => {
  await page.goto('/settings');
  // RequireAuth guard triggers → redirects unauthenticated users to /Login.
  await expect(page).toHaveURL(/\/Login/, { timeout: 10_000 });
});
