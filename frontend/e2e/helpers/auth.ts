import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials before globalSetup runs (config loads them too, but
// globalSetup may run in a separate process depending on Playwright version).
dotenv.config({ path: path.join(__dirname, '../.env.test') });

async function globalSetup() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in e2e/.env.test');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app first so localStorage writes are scoped to :5173.
  await page.goto('http://localhost:5173/Login');

  // Login through the browser's cookie jar — httpOnly cookies are captured
  // automatically because page.request uses the same context.
  const response = await page.request.post('http://localhost:8000/users/login', {
    data: { identifier: email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `Login failed (${response.status()}): ${await response.text()}`
    );
  }

  const { user } = await response.json();

  // Mirror exactly what LogIn.tsx writes after a successful login.
  await page.evaluate(
    (u: { id: number; email: string; username: string }) => {
      localStorage.setItem('userId', String(u.id));
      localStorage.setItem('email', u.email);
      localStorage.setItem('username', u.username);
    },
    user
  );

  // Persist cookies + localStorage together so all tests pick them up.
  await context.storageState({ path: path.join(__dirname, 'auth.json') });
  await browser.close();
}

export default globalSetup;
