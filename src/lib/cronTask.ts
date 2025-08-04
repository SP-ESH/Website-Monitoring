import fs from 'fs';
import path from 'path';
import { runLighthouse } from './lighthouseRunner';
import { runPuppeteerTasks } from './puppeteerRunner';
import { fetchSecurityHeaders } from './securityHeaders';

export const runMonitor = async () => {
    const urls = [
        'https://example.com',
        'https://your-second-url.com'
    ];
    const results: any[] = [];

    for (const url of urls) {
        try {
            const [lighthouseData, puppeteerData, headersData] = await Promise.all([
                runLighthouse(url),
                runPuppeteerTasks(url),
                fetchSecurityHeaders(url),
            ]);
            results.push({ url, lighthouse: lighthouseData, network: puppeteerData.network, console: puppeteerData.console, security: headersData });
        } catch (err: any) {
            results.push({ url, error: err?.message || 'Unknown error' });
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(process.cwd(), 'logs', `monitor-${timestamp}.json`);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    console.log(`Saved monitoring results to ${filePath}`);
};

// pages/api/cron-monitor.ts
// import type { NextApiRequest, NextApiResponse } from 'next';
// // Removed duplicate import of runMonitor

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//     if (req.query.secret !== process.env.CRON_SECRET) {
//         return res.status(401).json({ error: 'Unauthorized' });
//     }
//     await runMonitor();
//     res.status(200).json({ success: true });
// }