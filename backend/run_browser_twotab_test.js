const puppeteer = require('puppeteer-core');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = 'http://localhost:3000';
const APPOINTMENT_ID = '3f8630db-e541-45f9-a87b-37d9342ab300';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

const tokenAdminA = jwt.sign(
  { id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b', role: 'admin', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b', email: 'admin_hospital_a@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);
const userObj = {
  id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b',
  name: 'Admin Hospital A',
  email: 'admin_hospital_a@test.com',
  role: 'admin',
  hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runBrowserTest() {
  console.log('--- LAUNCHING TWO-TAB BROWSER TEST (MICROSOFT EDGE) ---');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // TAB 1 Setup
  const page1 = await browser.newPage();
  
  // Track network requests on Tab 1
  page1.on('response', (res) => {
    if (res.url().includes('/vitals')) {
      const now = new Date().toISOString();
      console.log(`[TAB 1 NETWORK LOG ${now}] ${res.request().method()} ${res.url()} -> Status ${res.status()} | X-Cache Header: ${res.headers()['x-cache'] || 'NONE'}`);
    }
  });

  await page1.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page1.evaluate((tok, usr) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(usr));
  }, tokenAdminA, userObj);

  console.log('Navigating Tab 1 to Appointment Detail Page...');
  await page1.goto(`${APP_URL}/appointments/${APPOINTMENT_ID}`, { waitUntil: 'domcontentloaded' });
  await page1.waitForSelector('input[placeholder="72"]', { timeout: 10000 }).catch(() => {});
  await sleep(2000);

  // Read Tab 1 Initial DOM State
  const t1 = new Date().toISOString();
  const tab1_initial = await page1.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name || i.placeholder || i.getAttribute('aria-label') || i.type,
      value: i.value
    }));
    return {
      inputValues: inputs.filter(i => i.value)
    };
  });

  console.log(`\n====================================================`);
  console.log(`[TIMESTAMP T1: ${t1}] TAB 1 INITIAL RENDERED DOM VALUES`);
  console.log(`====================================================`);
  console.log(JSON.stringify(tab1_initial, null, 2));


  // TAB 2 Setup (Same session context shares localStorage)
  console.log('\nOpening Tab 2 in same browser session context...');
  const page2 = await browser.newPage();

  page2.on('response', (res) => {
    if (res.url().includes('/vitals')) {
      const now = new Date().toISOString();
      console.log(`[TAB 2 NETWORK LOG ${now}] ${res.request().method()} ${res.url()} -> Status ${res.status()} | X-Cache Header: ${res.headers()['x-cache'] || 'NONE'}`);
    }
  });

  await page2.goto(`${APP_URL}/appointments/${APPOINTMENT_ID}`, { waitUntil: 'domcontentloaded' });
  await page2.waitForSelector('input[placeholder="72"]', { timeout: 10000 }).catch(() => {});
  await sleep(2000);

  const newHeartRateValue = '94';
  const t2 = new Date().toISOString();
  console.log(`\n====================================================`);
  console.log(`[TIMESTAMP T2: ${t2}] TAB 2 SUBMITTING VITALS FORM VIA UI`);
  console.log(`New Pulse Value to set: ${newHeartRateValue}`);
  console.log(`====================================================`);

  // Type new vitals value and submit Tab 2 UI form via React state dispatch
  await page2.evaluate((val) => {
    const input = document.querySelector('input[placeholder="72"]');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const form = document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }, newHeartRateValue);
  await sleep(2000);
  console.log('Tab 2 UI Vitals Form Submitted Successfully.');

  // Step 3: Switch back to Tab 1 WITHOUT RELOADING
  console.log('\nStep 3: Switching back to Tab 1. Waiting 12 seconds WITHOUT RELOADING to allow 10s refetchInterval polling...');
  await page1.bringToFront();
  await sleep(12000);

  // Read Tab 1 DOM Vitals again
  const t3 = new Date().toISOString();
  const tab1_updated = await page1.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name || i.placeholder || i.getAttribute('aria-label') || i.type,
      value: i.value
    }));
    return {
      inputValues: inputs.filter(i => i.value)
    };
  });

  console.log(`\n====================================================`);
  console.log(`[TIMESTAMP T3: ${t3}] TAB 1 RENDERED DOM AFTER 12s AUTO-POLL (NO RELOAD)`);
  console.log(`====================================================`);
  console.log(JSON.stringify(tab1_updated, null, 2));

  await browser.close();
  process.exit(0);
}

runBrowserTest().catch((err) => {
  console.error('Browser Automation Error:', err);
  process.exit(1);
});
