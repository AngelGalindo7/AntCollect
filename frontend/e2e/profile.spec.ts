import { test, expect } from '@playwright/test';

// Uses the project-level storageState (authenticated).
// All own-profile tests navigate to /${TEST_USERNAME}.

test('own profile renders the avatar upload button', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);
  await expect(page.getByRole('button', { name: 'Upload avatar' })).toBeVisible();
});

test('showcase tab is the default active tab on profile load', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);
  const showcaseTab = page.getByRole('button', { name: 'Showcase', exact: true });
  await expect(showcaseTab).toBeVisible();
  await expect(showcaseTab).toHaveClass(/border-uci-gold/);
});

test('owner can enter edit mode and see Add Canvas button in showcase tab', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);
  // The Showcase tab renders the multi-panel Workspace. Owners always see the
  // Edit Showcase entry button; clicking it reveals the Add Canvas toolbar action.
  await page.getByRole('button', { name: /edit showcase/i }).click();
  await expect(page.getByRole('button', { name: /add canvas/i })).toBeVisible();
});

test('sticker count is inline-editable', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);

  // Target the individual stat box (flex-col) containing the "Stickers" label.
  const stickersBox = page
    .getByTestId('profile-stats')
    .locator('div.flex-col')
    .filter({ has: page.locator('span', { hasText: 'Stickers' }) });
  const stickerValue = stickersBox
    .locator('span')
    .filter({ hasText: /^\d+$/ });

  await stickerValue.click();

  // After click, UserProfile replaces the span with an <input type="number">.
  const stickerInput = page.locator('input[type="number"]');
  await expect(stickerInput).toBeVisible();

  await stickerInput.fill('42');
  await stickerInput.press('Enter');

  // Input disappears; span shows the committed value.
  await expect(stickerInput).not.toBeVisible();
  await expect(stickersBox.locator('span').filter({ hasText: /^\d+$/ })).toHaveText('42');
});

test('visiting a different user profile shows no avatar upload button', async ({ page }) => {
  await page.goto(`/${process.env.TEST_OTHER_USERNAME}`);
  await expect(page.getByRole('button', { name: 'Upload avatar' })).not.toBeVisible();
});

test('clicking a folder card navigates to /folders/:folderId', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);

  // Seed a folder via the page's authenticated context. page.request shares
  // cookies with the page so this is guaranteed to use the same session as
  // the rest of the test — unlike the worker-scoped `request` fixture in
  // beforeAll, which has historically not picked up storageState reliably.
  const seedRes = await page.request.post('http://localhost:8000/folders', {
    data: { name: 'Folder Card Nav Test', folder_type: 'collection' },
  });
  expect(seedRes.ok(), `seed folder failed: ${seedRes.status()} ${await seedRes.text()}`).toBeTruthy();
  await page.reload({ waitUntil: 'networkidle' });

  // Default tab is Showcase — switch to Collection, then to the "folders" sub-filter.
  await page.getByRole('button', { name: 'Collection' }).click();
  await page.getByRole('button', { name: 'folders', exact: true }).click();

  const folderCard = page.locator('[data-testid="folder-card"]').first();
  await expect(folderCard).toBeVisible();
  await folderCard.click();
  await expect(page).toHaveURL(/\/folders\/\d+/);
});
