import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduledMonitor, MonitoringConfig } from '../../lib/monitor/scheduledMonitor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const scheduler = ScheduledMonitor.getInstance();

    switch (req.method) {
        case 'POST':
            return handleAddJob(req, res, scheduler);
        case 'GET':
            return handleGetJobs(req, res, scheduler);
        case 'PUT':
            return handleUpdateJob(req, res, scheduler);
        case 'DELETE':
            return handleRemoveJob(req, res, scheduler);
        default:
            return res.status(405).json({ error: 'Method Not Allowed' });
    }
}

async function handleAddJob(req: NextApiRequest, res: NextApiResponse, scheduler: ScheduledMonitor) {
    const { id, config } = req.body;

    if (!id || !config || !config.url || !config.schedule) {
        return res.status(400).json({
            error: "Missing required fields: id, config.url, and config.schedule are required"
        });
    }

    try {
        scheduler.addJob(id, config as MonitoringConfig);
        return res.status(201).json({
            message: 'Monitoring job added successfully',
            jobId: id
        });
    } catch (error: any) {
        return res.status(500).json({
            error: "Failed to add monitoring job",
            details: error.message
        });
    }
}

async function handleGetJobs(req: NextApiRequest, res: NextApiResponse, scheduler: ScheduledMonitor) {
    const { id } = req.query;

    if (id && typeof id === 'string') {
        const job = scheduler.getJob(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        return res.status(200).json({ job });
    }

    const jobs = scheduler.getAllJobs();
    return res.status(200).json({ jobs });
}

async function handleUpdateJob(req: NextApiRequest, res: NextApiResponse, scheduler: ScheduledMonitor) {
    const { id } = req.query;
    const { config } = req.body;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Job ID is required" });
    }

    if (!config) {
        return res.status(400).json({ error: "Config is required" });
    }

    try {
        scheduler.updateJobConfig(id, config as MonitoringConfig);
        return res.status(200).json({
            message: 'Monitoring job updated successfully',
            jobId: id
        });
    } catch (error: any) {
        return res.status(500).json({
            error: "Failed to update monitoring job",
            details: error.message
        });
    }
}

async function handleRemoveJob(req: NextApiRequest, res: NextApiResponse, scheduler: ScheduledMonitor) {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Job ID is required" });
    }

    try {
        scheduler.removeJob(id);
        return res.status(200).json({
            message: 'Monitoring job removed successfully',
            jobId: id
        });
    } catch (error: any) {
        return res.status(500).json({
            error: "Failed to remove monitoring job",
            details: error.message
        });
    }
} 