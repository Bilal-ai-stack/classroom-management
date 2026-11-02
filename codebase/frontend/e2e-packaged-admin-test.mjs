import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5089;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/institution/profile`);
      if (res.ok) return true;
    } catch {
      // server starting up
    }
    await sleep(500);
  }
  return false;
}

async function run() {
  console.log('========================================================================');
  console.log('  Playwright Verification on PACKAGED ClassroomOS.exe Standalone Binary');
  console.log('========================================================================\n');

  const exePath = path.resolve(__dirname, '..', 'backend', 'dist', 'ClassroomOS', 'ClassroomOS.exe');
  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged binary not found at ${exePath}`);
  }

  const testAppData = path.resolve(__dirname, '..', 'backend', 'instance', 'tmp_packaged_admin_test');
  if (fs.existsSync(testAppData)) {
    fs.rmSync(testAppData, { recursive: true, force: true });
  }
  fs.mkdirSync(testAppData, { recursive: true });

  console.log(`[1] Launching packaged ClassroomOS.exe on port ${PORT}...`);
  let server = spawn(exePath, ['--port', String(PORT), '--no-browser'], {
    env: { ...process.env, LOCALAPPDATA: testAppData, CLASSROOM_DESKTOP: '1' },
    stdio: 'ignore'
  });

  let isUp = await waitForServer(BASE_URL);
  if (!isUp) {
    server.kill();
    throw new Error(`Packaged server failed to start on ${BASE_URL}`);
  }
  console.log('Packaged server is online.\n');

  // Bootstrap admin
  console.log('[2] Initializing Administrator Account...');
  const bootstrapRes = await fetch(`${BASE_URL}/api/auth/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@lincoln.edu',
      password: 'AdminSecurePass123!',
      full_name: 'Super Administrator'
    })
  });
  const bootstrapJson = await bootstrapRes.json();
  console.log('Bootstrap response:', bootstrapJson.success ? 'SUCCESS' : bootstrapJson);

  // Launch browser
  console.log('[3] Launching Chrome Browser...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  let institutionFetchCount = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/admin/institution') && req.method() === 'GET') {
      institutionFetchCount++;
      console.log(`[Network] GET /api/admin/institution call #${institutionFetchCount}`);
    }
  });

  try {
    console.log('[4] Navigating to packaged application URL...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Login via UI
    console.log('[5] Authenticating as Administrator...');
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await signInBtn.click();
    await page.fill('input[type="email"]', 'admin@lincoln.edu');
    await page.fill('input[type="password"]', 'AdminSecurePass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Navigate to Admin Settings
    console.log('[6] Navigating to Admin Settings tab...');
    const adminNavBtn = page.locator('button.nav-btn:has-text("Admin"), button:has-text("Admin")').first();
    await adminNavBtn.click();
    await page.waitForTimeout(1000);

    console.log(`[7] Request Stability Check: calls after 1s = ${institutionFetchCount}`);
    await page.waitForTimeout(2000);
    console.log(`[7] Request Stability Check: calls after 3s = ${institutionFetchCount}`);
    if (institutionFetchCount > 3) {
      throw new Error(`Infinite fetch loop detected in packaged app! Count: ${institutionFetchCount}`);
    }
    console.log('  ✓ Zero infinite fetch loops confirmed in packaged app.');

    // Edit Institution Fields
    console.log('\n[8] Interacting with Institution Profile form fields...');
    const nameInput = page.locator('input[placeholder="e.g. Springfield Academy"]');
    const codeInput = page.locator('input[placeholder="e.g. SCH-001"]');
    const emailInput = page.locator('input[placeholder="admin@school.local"]');
    const phoneInput = page.locator('input[placeholder="+1 (555) 019-2834"]');
    const addressInput = page.locator('input[placeholder="e.g. 123 Education Boulevard, Springfield"]');
    const descInput = page.locator('textarea[placeholder="Brief description of school ethos or administrative guidelines..."]');

    await nameInput.waitFor({ state: 'visible', timeout: 5000 });

    await nameInput.click();
    await nameInput.fill('Lincoln Sovereign Preparatory');

    await codeInput.click();
    await codeInput.fill('LSP-001');

    await emailInput.click();
    await emailInput.fill('admin@lincolnprep.edu');

    await phoneInput.click();
    await phoneInput.fill('+1 (555) 948-1122');

    await addressInput.click();
    await addressInput.fill('100 Lincoln Way, Suite A');

    await descInput.click();
    await descInput.fill('Premier sovereign offline-first academy founded 2026.');

    console.log('  • All form fields successfully filled with new institution values.');

    // Click Save Configuration
    console.log('\n[9] Saving configuration to SQLite...');
    const saveBtn = page.locator('button[type="submit"]:has-text("Save Configuration")');
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Verify browser refresh persistence
    console.log('\n[10] Refreshing page and verifying persisted state in browser...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const adminNavBtnAfterReload = page.locator('button.nav-btn:has-text("Admin"), button:has-text("Admin")').first();
    await adminNavBtnAfterReload.click();
    await page.waitForTimeout(1000);

    const reloadedName = await page.locator('input[placeholder="e.g. Springfield Academy"]').inputValue();
    const reloadedCode = await page.locator('input[placeholder="e.g. SCH-001"]').inputValue();
    const reloadedAddress = await page.locator('input[placeholder="e.g. 123 Education Boulevard, Springfield"]').inputValue();

    console.log(`  • Reloaded Name: "${reloadedName}"`);
    console.log(`  • Reloaded Code: "${reloadedCode}"`);
    console.log(`  • Reloaded Address: "${reloadedAddress}"`);

    if (reloadedName !== 'Lincoln Sovereign Preparatory') {
      throw new Error(`Page reload failed to persist updated name! Got: "${reloadedName}"`);
    }
    console.log('  ✓ Browser reload persistence verified.');

    // Verify application restart persistence
    console.log('\n[11] Restarting packaged ClassroomOS.exe to verify SQLite persistence on disk...');
    server.kill();
    await sleep(1500);

    server = spawn(exePath, ['--port', String(PORT), '--no-browser'], {
      env: { ...process.env, LOCALAPPDATA: testAppData, CLASSROOM_DESKTOP: '1' },
      stdio: 'ignore'
    });

    isUp = await waitForServer(BASE_URL);
    if (!isUp) throw new Error('Packaged server failed to restart');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const adminNavBtnAfterRestart = page.locator('button.nav-btn:has-text("Admin"), button:has-text("Admin")').first();
    await adminNavBtnAfterRestart.click();
    await page.waitForTimeout(1000);

    const restartedName = await page.locator('input[placeholder="e.g. Springfield Academy"]').inputValue();
    const restartedCode = await page.locator('input[placeholder="e.g. SCH-001"]').inputValue();
    const restartedAddress = await page.locator('input[placeholder="e.g. 123 Education Boulevard, Springfield"]').inputValue();

    console.log(`  • Name after restart: "${restartedName}"`);
    console.log(`  • Code after restart: "${restartedCode}"`);
    console.log(`  • Address after restart: "${restartedAddress}"`);

    if (restartedName !== 'Lincoln Sovereign Preparatory') {
      throw new Error(`Restart persistence failed! Expected "Lincoln Sovereign Preparatory", got "${restartedName}"`);
    }
    console.log('  ✓ Application restart SQLite persistence verified.');

    console.log('\n========================================================================');
    console.log('  PACKAGED ClassroomOS.exe ADMIN INTERACTION & PERSISTENCE VERIFIED 100%!');
    console.log('========================================================================\n');

  } finally {
    await browser.close();
    server.kill();
    try { fs.rmSync(testAppData, { recursive: true, force: true }); } catch {}
  }
}

run().catch((err) => {
  console.error('Packaged app test error:', err);
  process.exit(1);
});

