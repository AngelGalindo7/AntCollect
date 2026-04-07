import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env.test') });

export default defineConfig({
  testDir: '.',
  globalSetup: './helpers/auth.ts',
  // Retry twice in CI to absorb transient flakes; no retries locally.
  retries: process.env.CI ? 2 : 0,
  // Serial execution prevents the username-change test from racing with
  // profile tests that navigate to /${TEST_USERNAME}.
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    // All authenticated tests load saved cookies + localStorage by default.
    storageState: path.join(__dirname, 'helpers/auth.json'),
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
