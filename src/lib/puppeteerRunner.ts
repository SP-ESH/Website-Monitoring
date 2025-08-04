import puppeteer from 'puppeteer';
import PuppeteerHar from 'puppeteer-har';
import fs from 'fs';
import path from 'path';

export async function runPuppeteerTasks(url: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const har = new PuppeteerHar(page);
    const consoleLogs: string[] = [];

    page.on('console', msg => consoleLogs.push(msg.text()));

    const harPath = path.join(process.cwd(), 'network-' + Date.now() + '.har');
    await har.start({ path: harPath });
    await page.goto(url, { waitUntil: 'networkidle2' });
    await har.stop();

    const harContent = fs.readFileSync(harPath, 'utf-8');
    const network = JSON.parse(harContent);
    fs.unlinkSync(harPath);

    await browser.close();

    return {
        console: consoleLogs,
        network
    };
}
