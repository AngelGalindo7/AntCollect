import { test, expect } from '@playwright/test';

// Override the project-level storageState — every test in this file must start
// without any cookies or localStorage so we can test the auth flow itself.
test.use({ storageState: { cookies: [], origins: [] } });

test('login with valid credentials redirects to /:username', async ({ page }) => {
  await page.goto('/Login');
  await page.locator('input[type="text"]').fill(process.env.TEST_USER_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Create Account' }).click();
  // LogIn.tsx navigates to /${data.user.username} on success.
  await expect(page).toHaveURL(new RegExp(`/${process.env.TEST_USERNAME}$`));
});

test('login with wrong password shows an error message', async ({ page }) => {
  await page.goto('/Login');
  await page.locator('input[type="text"]').fill(process.env.TEST_USER_EMAIL!);
  await page.locator('input[type="password"]').fill('wrong_password_xyz_99');
  await page.getByRole('button', { name: 'Create Account' }).click();
  // LogIn.tsx renders: {error && <p style={{ color: "red", ... }}>{error}</p>}
  await expect(page.locator('p[style*="color: red"]')).toBeVisible();
});

test('unauthenticated visit to / redirects to /Login', async ({ page }) => {
  await page.goto('/');
  // fetchWithAuth fires → 401 → refresh fails → window.location.href = "/Login"
  await expect(page).toHaveURL(/\/Login/, { timeout: 10_000 });
});
