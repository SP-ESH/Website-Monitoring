import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduledMonitor } from '../../lib/monitor/scheduledMonitor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { jobId } = req.body;

    if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({ error: "Job ID is required" });
    }

    try {
        const scheduler = ScheduledMonitor.getInstance();
        const result = await scheduler.runJobNow(jobId);

        if (!result) {
            return res.status(404).json({ error: 'Job not found or not active' });
        }

        return res.status(200).json({
            message: 'Job executed successfully',
            result
        });
    } catch (error: any) {
        return res.status(500).json({
            error: "Failed to run monitoring job",
            details: error.message
        });
    }
} 