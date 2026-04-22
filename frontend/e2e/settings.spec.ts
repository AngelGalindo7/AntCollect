import { test, expect } from '@playwright/test';

// Uses the project-level storageState (authenticated).

test('/settings?tab=profile loads with current username pre-filled', async ({ page }) => {
  await page.goto('/settings?tab=profile');
  // ProfileTab queries GET /users/me and initialises the username input.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  // Scope to the settings card within main content to avoid matching the global Search
  // input in the header.
  const usernameInput = page.getByTestId('main-content').locator('input[type="text"]');
  // ProfileTab fetches /users/me before rendering the input; allow 15 s for CI.
  await expect(usernameInput).toHaveValue(process.env.TEST_USERNAME!, { timeout: 15_000 });
});

test.describe('username change', () => {
  const newUsername = `${process.env.TEST_USERNAME}_pw`;

  // Restore the original username after the test so auth.json stays valid
  // and other specs that navigate to /${TEST_USERNAME} continue to work.
  test.afterEach(async ({ request }) => {
    const res = await request.patch('http://localhost:8000/users/me/profile', {
      data: { username: process.env.TEST_USERNAME },
    });
    if (!res.ok()) throw new Error(`Username restore failed (${res.status()}): ${await res.text()}`);
  });

  test('username change persists after page reload', async ({ page }) => {
    await page.goto('/settings?tab=profile');

    const usernameInput = page.locator('.max-w-2xl input[type="text"]');
    // Wait for ProfileTab's /users/me query before interacting; allow 15 s for CI.
    await expect(usernameInput).toBeVisible({ timeout: 15_000 });
    await usernameInput.clear();
    await usernameInput.fill(newUsername);
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Wait for the mutation to succeed (button returns to "Save changes").
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

    await page.reload();

    // ProfileTab re-fetches GET /users/me on mount; input must show new value.
    await expect(page.getByTestId('main-content').locator('input[type="text"]')).toHaveValue(newUsername, { timeout: 15_000 });
  });
});
