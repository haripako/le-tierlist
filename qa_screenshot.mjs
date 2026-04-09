import { chromium } from './node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

try {
  // Home page
  await page.goto('http://localhost:5000/#/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/user/workspace/buildtier-qa-home.png', fullPage: true });
  console.log('Home screenshot saved');

  // Last Epoch game page
  await page.goto('http://localhost:5000/#/game/last-epoch', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/user/workspace/buildtier-qa-last-epoch.png', fullPage: true });
  console.log('Last Epoch screenshot saved');
} catch(e) {
  console.error('Error:', e.message);
}

await browser.close();
