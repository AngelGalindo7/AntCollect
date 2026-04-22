import { test, expect } from '@playwright/test';

// Uses the project-level storageState (authenticated).

test('authenticated visit to / does not redirect', async ({ page }) => {
  await page.goto('/');
  // HomePage confirms the feed loaded and the
  // auth cookie was accepted by FastAPI without triggering a /Login redirect.
  await expect(page).toHaveURL('/');
});
