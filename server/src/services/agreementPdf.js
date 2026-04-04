import puppeteer from 'puppeteer';
import { renderAgreementDocumentHtml } from './agreementHtml.js';

let browserPromise;

function launchOptions() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch(launchOptions());
  }
  return browserPromise;
}

/**
 * @param {object} agreementData - snapshot JSON (same shape as preview)
 * @returns {Promise<Buffer>}
 */
export async function agreementDataToPdfBuffer(agreementData) {
  const html = renderAgreementDocumentHtml(agreementData);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
    });
  } finally {
    await page.close();
  }
}
