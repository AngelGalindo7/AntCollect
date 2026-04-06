import { test, expect } from '@playwright/test';

// Uses the project-level storageState (authenticated).

test('authenticated visit to / does not redirect', async ({ page }) => {
  await page.goto('/');
  // HomePage renders <h1>Explore</h1> — confirms the feed loaded and the
  // auth cookie was accepted by FastAPI without triggering a /Login redirect.
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await expect(page).toHaveURL('/');
});
