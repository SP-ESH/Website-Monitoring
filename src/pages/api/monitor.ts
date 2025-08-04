import { NextApiRequest, NextApiResponse } from 'next';
import { ComprehensiveMonitor } from '../../lib/monitor/comprehensiveMonitor';
import { runLighthouse } from '../../lib/lighthouseRunner';
import { runPuppeteerTasks } from '@/lib/puppeteerRunner';
import { fetchSecurityHeaders } from '../../lib/securityHeaders';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url, keyword } = req.body || {};
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const monitor = ComprehensiveMonitor.getInstance();
        const comprehensiveResult = await monitor.monitorWebsite(url, keyword);

        // Run additional checks in parallel
        const [lighthouseData, puppeteerData, headersData] = await Promise.all([
            runLighthouse(url).catch(err => ({ error: err.message })),
            runPuppeteerTasks(url).catch(err => ({ error: err.message })),
            fetchSecurityHeaders(url).catch(err => ({ error: err.message })),
        ]);

        return res.status(200).json({
            ...comprehensiveResult,
            lighthouse: lighthouseData,
            network: 'network' in puppeteerData ? puppeteerData.network : null,
            console: 'console' in puppeteerData ? puppeteerData.console : null,
            security: headersData,
        });
    } catch (err: any) {
        return res.status(500).json({ error: "Monitoring failed", details: err?.message });
    }
}
