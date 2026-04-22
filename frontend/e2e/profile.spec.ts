import { test, expect } from '@playwright/test';

// Uses the project-level storageState (authenticated).
// All own-profile tests navigate to /${TEST_USERNAME}.

// The CI seed step creates users but no folders, so we create one here and
// clean it up afterwards to keep the DB in the same state.
let seedFolderId: number;

test.beforeAll(async ({ request }) => {
  const res = await request.post('http://localhost:8000/folders', {
    data: { name: 'CI Test Folder', folder_type: 'collection' },
  });
  if (!res.ok()) throw new Error(`Failed to create seed folder: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  seedFolderId = body.id;
});

test.afterAll(async ({ request }) => {
  if (seedFolderId) {
    await request.delete(`http://localhost:8000/folders/${seedFolderId}`);
  }
});

test('own profile renders the avatar upload button', async ({ page }) => {
  await page.goto(`/${process.env.TEST_USERNAME}`);
  // UserProfile.tsx renders this button only when profile.is_owner is true.
  await expect(page.getByRole('button', { name: 'Upload avatar' })).toBeVisible();
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
  // FolderCard renders data-testid="folder-card" on its outer div.
  // Clicking anywhere inside the card triggers navigation.
  await page.locator('[data-testid="folder-card"]').first().click();
  await expect(page).toHaveURL(/\/folders\/\d+/);
});
