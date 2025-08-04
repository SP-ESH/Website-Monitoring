import type { NextApiRequest, NextApiResponse } from 'next';
import { ComprehensiveMonitor } from '../../lib/monitor/comprehensiveMonitor';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = req.headers['x-monitor-url'] as string;

    if (!url) {
        return res.status(400).json({ error: 'URL is required in x-monitor-url header' });
    }

    try {
        // Validate URL format
        new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        const monitor = ComprehensiveMonitor.getInstance();
        const result = await monitor.monitorWebsite(url);
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to monitor website' });
    }
}
