import { runMonitor } from '@/lib/cronTask';
import type { NextApiRequest, NextApiResponse } from 'next';
// Removed duplicate import of runMonitor

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.query.secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    await runMonitor();
    res.status(200).json({ success: true });
}