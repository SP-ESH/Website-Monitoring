import cron from 'node-cron';
import { ComprehensiveMonitor, MonitoringResult } from './comprehensiveMonitor';
import nodemailer from 'nodemailer';

export interface MonitoringConfig {
    url: string;
    keyword?: string;
    schedule: string; // cron expression
    emailNotifications?: {
        enabled: boolean;
        recipients: string[];
        smtp: {
            host: string;
            port: number;
            secure: boolean;
            auth: {
                user: string;
                pass: string;
            };
        };
    };
    alertThresholds?: {
        responseTime: number; // ms
        sslExpiryDays: number;
        domainExpiryDays: number;
    };
}

export interface MonitoringJob {
    id: string;
    config: MonitoringConfig;
    lastRun?: Date;
    lastResult?: MonitoringResult;
    isActive: boolean;
}

export class ScheduledMonitor {
    private static instance: ScheduledMonitor;
    private jobs: Map<string, MonitoringJob> = new Map();
    private monitor: ComprehensiveMonitor;

    private constructor() {
        this.monitor = ComprehensiveMonitor.getInstance();
    }

    public static getInstance(): ScheduledMonitor {
        if (!ScheduledMonitor.instance) {
            ScheduledMonitor.instance = new ScheduledMonitor();
        }
        return ScheduledMonitor.instance;
    }

    public addJob(id: string, config: MonitoringConfig): void {
        const job: MonitoringJob = {
            id,
            config,
            isActive: true
        };

        this.jobs.set(id, job);

        // Schedule the job
        cron.schedule(config.schedule, async () => {
            if (job.isActive) {
                await this.runJob(job);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log(`Scheduled monitoring job for ${config.url} with schedule: ${config.schedule}`);
    }

    public removeJob(id: string): void {
        const job = this.jobs.get(id);
        if (job) {
            job.isActive = false;
            this.jobs.delete(id);
            console.log(`Removed monitoring job: ${id}`);
        }
    }

    public getJob(id: string): MonitoringJob | undefined {
        return this.jobs.get(id);
    }

    public getAllJobs(): MonitoringJob[] {
        return Array.from(this.jobs.values());
    }

    public async runJobNow(id: string): Promise<MonitoringResult | null> {
        const job = this.jobs.get(id);
        if (!job || !job.isActive) {
            return null;
        }

        return await this.runJob(job);
    }

    private async runJob(job: MonitoringJob): Promise<MonitoringResult> {
        console.log(`Running monitoring job for ${job.config.url}`);

        try {
            const result = await this.monitor.monitorWebsite(job.config.url, job.config.keyword);

            job.lastRun = new Date();
            job.lastResult = result;

            // Check for alerts
            await this.checkAlerts(job, result);

            console.log(`Monitoring completed for ${job.config.url}`);
            return result;
        } catch (error) {
            console.error(`Monitoring failed for ${job.config.url}:`, error);
            throw error;
        }
    }

    private async checkAlerts(job: MonitoringJob, result: MonitoringResult): Promise<void> {
        const config = job.config;

        if (!config.emailNotifications?.enabled) {
            return;
        }

        const alerts: string[] = [];

        // Check response time
        if (config.alertThresholds?.responseTime &&
            result.responseTime.value > config.alertThresholds.responseTime) {
            alerts.push(`Response time ${result.responseTime.value}ms exceeds threshold of ${config.alertThresholds.responseTime}ms`);
        }

        // Check SSL certificate expiry
        if (config.alertThresholds?.sslExpiryDays &&
            result.sslMonitoring.certificate?.daysUntilExpiry &&
            result.sslMonitoring.certificate.daysUntilExpiry <= config.alertThresholds.sslExpiryDays) {
            alerts.push(`SSL certificate expires in ${result.sslMonitoring.certificate.daysUntilExpiry} days`);
        }

        // Check domain expiry
        if (config.alertThresholds?.domainExpiryDays &&
            result.domainExpiration.daysUntilExpiry &&
            result.domainExpiration.daysUntilExpiry <= config.alertThresholds.domainExpiryDays) {
            alerts.push(`Domain expires in ${result.domainExpiration.daysUntilExpiry} days`);
        }

        // Check website status
        if (result.websiteMonitoring.status !== 'online') {
            alerts.push(`Website is ${result.websiteMonitoring.status}`);
        }

        // Check SSL status
        if (result.sslMonitoring.status === 'expired') {
            alerts.push('SSL certificate has expired');
        }

        // Check domain expiry status
        if (result.domainExpiration.status === 'expired') {
            alerts.push('Domain has expired');
        }

        // Send email alerts if any
        if (alerts.length > 0) {
            await this.sendAlertEmail(job, result, alerts);
        }
    }

    private async sendAlertEmail(job: MonitoringJob, result: MonitoringResult, alerts: string[]): Promise<void> {
        try {
            const config = job.config.emailNotifications!;

            const transporter = nodemailer.createTransport({
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.secure,
                auth: config.smtp.auth
            });

            const alertHtml = alerts.map(alert => `<li>${alert}</li>`).join('');

            const emailContent = `
        <h2>Website Monitoring Alert</h2>
        <p><strong>URL:</strong> ${result.url}</p>
        <p><strong>Time:</strong> ${result.timestamp}</p>
        <p><strong>Status:</strong> ${result.websiteMonitoring.status}</p>
        <p><strong>Response Time:</strong> ${result.responseTime.value}ms</p>
        
        <h3>Alerts:</h3>
        <ul>${alertHtml}</ul>
        
        <h3>Full Monitoring Results:</h3>
        <pre>${JSON.stringify(result, null, 2)}</pre>
      `;

            await transporter.sendMail({
                from: config.smtp.auth.user,
                to: config.recipients.join(', '),
                subject: `Website Monitoring Alert - ${result.url}`,
                html: emailContent
            });

            console.log(`Alert email sent for ${result.url}`);
        } catch (error) {
            console.error('Failed to send alert email:', error);
        }
    }

    public getJobStatus(id: string): { job: MonitoringJob | undefined; isRunning: boolean } {
        const job = this.jobs.get(id);
        return {
            job,
            isRunning: job?.isActive || false
        };
    }

    public updateJobConfig(id: string, config: MonitoringConfig): void {
        const job = this.jobs.get(id);
        if (job) {
            // Remove old schedule
            job.isActive = false;

            // Add new job with updated config
            this.addJob(id, config);
        }
    }
} 