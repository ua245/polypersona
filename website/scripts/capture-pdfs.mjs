import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 4173;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve('pdfs');

fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: '01-landing',     path: '/' },
  { name: '02-signin',      path: '/signin' },
  { name: '03-tests',       path: '/tests' },
  { name: '04-new-test',    path: '/tests/new' },
  { name: '05-test-live',   path: '/tests/t1' },
  { name: '06-personas',    path: '/personas' },
  { name: '07-agent',       path: '/personas/p1' },
  { name: '08-insights',    path: '/insights' },
];

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  for (const { name, path: route } of PAGES) {
    console.log(`Capturing ${name}...`);
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    const outPath = path.join(OUT, `${name}.pdf`);
    await page.pdf({
      path: outPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12px', bottom: '12px', left: '12px', right: '12px' },
    });
    console.log(`  -> saved ${outPath}`);
  }

  await browser.close();
  console.log('\nDone! PDFs saved to ./pdfs/');
})();
