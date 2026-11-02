import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5092;
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

// Generate simple 100x100 PNG test image buffer
function createPngBuffer() {
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6klEQVR4nO3SMREAIRAEQXh3iEEIrt/CTd4dbzS1+9y3mPmGO8RqPCsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArEGvN/e9SAgeN+SKiAAAAAElFTkSuQmCC';
  return Buffer.from(base64Png, 'base64');
}

async function run() {
  console.log('========================================================================');
  console.log('  Playwright E2E: Student Photograph Persistence & Storage Management');
  console.log('========================================================================\n');

  const testTempDir = path.resolve(__dirname, '..', 'backend', 'instance', `test_e2e_photo_${Date.now()}`);
  const dataDir = path.join(testTempDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const testImageFile = path.join(testTempDir, 'synthetic_student_photo.png');
  fs.writeFileSync(testImageFile, createPngBuffer());

  const testImageFile2 = path.join(testTempDir, 'synthetic_student_photo2.png');
  fs.writeFileSync(testImageFile2, createPngBuffer());

  const pythonExe = path.resolve(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe');
  const launcherScript = path.resolve(__dirname, '..', 'backend', 'launcher.py');

  console.log(`[1/6] Launching backend server on port ${PORT}...`);
  const serverProc = spawn(pythonExe, [launcherScript, '--port', String(PORT), '--no-browser'], {
    env: {
      ...process.env,
      CLASSROOM_DATA_DIR: dataDir,
      CLASSROOM_DESKTOP: '1',
      SECRET_KEY: 'test-e2e-secret-key-storage'
    },
    stdio: 'ignore'
  });

  let browser;

  try {
    const ready = await waitForServer(BASE_URL);
    if (!ready) throw new Error('Server failed to start within timeout.');
    console.log('  -> Server is responsive.');

    console.log('[2/6] Connecting browser and bootstrapping Admin...');
    const bRes = await fetch(`${BASE_URL}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@lincoln.edu',
        password: 'AdminPass1234!',
        full_name: 'Principal Jane Doe'
      })
    });
    const bJson = await bRes.json();
    console.log('  -> Bootstrap API status:', bJson.success ? 'SUCCESS' : bJson.error || bJson.message);

    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/')) {
        console.log(`API RESPONSE [${resp.status()}]: ${resp.url()}`);
        if (resp.status() >= 400) {
          try { console.log('API ERROR BODY:', await resp.text()); } catch {}
        }
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Authenticate as Admin via UI
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await signInBtn.waitFor({ state: 'visible', timeout: 8000 });
    await signInBtn.click();
    await page.waitForSelector('text=Educator Sign-In');
    await page.fill('input[type="email"]', 'admin@lincoln.edu');
    await page.fill('input[type="password"]', 'AdminPass1234!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Educator Sign-In', { state: 'detached', timeout: 8000 });
    console.log('  -> Administrator authenticated.');

    // [3/6] Enroll student with photograph attachment
    console.log('[3/6] Enrolling new student with photograph attachment...');
    await page.click('button:has-text("Students"), a:has-text("Students")');
    await page.waitForSelector('button:has-text("Add Student")');
    await page.click('button:has-text("Add Student")');
    await page.waitForSelector('text=Enroll New Student');

    // Fill student details
    await page.fill('input[value^="R-"]', 'R-PHOTO-99');
    await page.fill('input[placeholder="e.g. Fatima Tariq"]', 'Zainab Qasim');
    await page.fill('input[type="date"]', '2026-11-02');

    // Attach student photo
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(testImageFile);
    await sleep(400);

    // Submit enrollment
    await page.click('button:has-text("Enroll Student")');
    await page.waitForSelector('text=Enroll New Student', { state: 'detached', timeout: 8000 });
    console.log('  -> Student Zainab Qasim enrolled with photo.');

    // [4/6] Verify photo in student roster table & student portfolio
    console.log('[4/6] Verifying student roster thumbnail & portfolio modal...');
    await page.waitForSelector('text=Zainab Qasim');
    const studentRow = page.locator('tr:has-text("Zainab Qasim")');
    const tableImg = studentRow.locator('img');
    await tableImg.waitFor({ state: 'visible', timeout: 5000 });
    const tableImgSrc = await tableImg.getAttribute('src');
    if (!tableImgSrc || !tableImgSrc.includes('/api/students/')) {
      throw new Error(`Invalid student table thumbnail src: ${tableImgSrc}`);
    }
    console.log(`  -> Table thumbnail verified: ${tableImgSrc}`);

    // Click student row to open portfolio modal
    await studentRow.click();
    await page.waitForSelector("text=Zainab Qasim's Portfolio");
    const portfolioImg = page.locator('.modal-content img[alt="Zainab Qasim"]');
    await portfolioImg.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Portfolio photo avatar verified.');

    // Replace photo from portfolio modal
    console.log('  -> Replacing photo from portfolio modal...');
    const portfolioFileInput = page.locator('.modal-content input[type="file"]');
    await portfolioFileInput.setInputFiles(testImageFile2);
    await sleep(1000);
    console.log('  -> Replacement photograph uploaded.');

    // Close portfolio modal
    await page.click('button:has-text("Close Portfolio")');
    await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 5000 });

    // [5/6] Refresh browser page and verify persistence across reloads
    console.log('[5/6] Refreshing browser to verify photo persistence...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('button:has-text("Students"), a:has-text("Students")');
    await page.waitForSelector('text=Zainab Qasim');
    const reloadedImg = page.locator('tr:has-text("Zainab Qasim") img');
    await reloadedImg.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Photograph confirmed persistent after full page reload.');

    // [6/6] Verify Admin Storage Dashboard Metrics
    console.log('[6/6] Verifying Admin Storage Dashboard & metrics...');
    await page.click('button:has-text("Admin"), a:has-text("Admin")');
    await page.waitForSelector('text=Institutional Administration');
    await page.click('button:has-text("Database & Backups")');
    await page.waitForSelector('text=Primary Database');
    await page.waitForSelector('text=Student Photos');
    await page.waitForSelector('text=Total App Data');
    await page.waitForSelector('text=Persistent Data Directory & Drive Selection');

    const photosText = await page.locator('text=/\\d+ Photos/').textContent();
    console.log(`  -> Storage screen verified student photos metric: "${photosText}"`);

    console.log('\n========================================================================');
    console.log('  SUCCESS: Playwright E2E Photo & Storage Test 100% PASSED!');
    console.log('========================================================================\n');
  } finally {
    if (browser) await browser.close();
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('\nPLAYWRIGHT TEST FAILED:', err);
  process.exit(1);
});
