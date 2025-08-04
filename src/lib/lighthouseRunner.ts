import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

export async function runLighthouse(url: string) {
    const chrome = await launch({ chromeFlags: ['--headless'] });
    const flags = { logLevel: 'info' as const, output: ['json'], port: chrome.port };
    const config = {
        extends: 'lighthouse:default',
        settings: {
            onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
        },
    };
    const result = await lighthouse(url, flags, config);
    chrome.kill();
    if (!result) {
        throw new Error('Lighthouse did not return a result.');
    }
    return result.lhr;
}
