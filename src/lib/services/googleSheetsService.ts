import { google } from 'googleapis';
import { MonitoringResult } from '../monitor/comprehensiveMonitor';

export interface GoogleSheetsConfig {
    spreadsheetId: string;
    credentials: {
        client_email: string;
        private_key: string;
    };
}

export class GoogleSheetsService {
    private static instance: GoogleSheetsService;
    private sheets: any;
    private config: GoogleSheetsConfig | null = null;

    private constructor() { }

    public static getInstance(): GoogleSheetsService {
        if (!GoogleSheetsService.instance) {
            GoogleSheetsService.instance = new GoogleSheetsService();
        }
        return GoogleSheetsService.instance;
    }

    public initialize(config: GoogleSheetsConfig): void {
        this.config = config;

        const auth = new google.auth.GoogleAuth({
            credentials: config.credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
    }

    public async exportMonitoringResults(results: MonitoringResult & { lighthouse?: any; network?: any; console?: any; security?: any }): Promise<boolean> {
        if (!this.config || !this.sheets) {
            throw new Error('Google Sheets not initialized. Please configure credentials first.');
        }

        try {
            const timestamp = new Date().toISOString();
            const rowData = this.formatResultsForSheets(results, timestamp);

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.config.spreadsheetId,
                range: 'A:Z',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [rowData]
                }
            });

            console.log('Monitoring results exported to Google Sheets successfully');
            return true;
        } catch (error) {
            console.error('Failed to export to Google Sheets:', error);
            return false;
        }
    }

    private formatResultsForSheets(results: MonitoringResult & { lighthouse?: any; network?: any; console?: any; security?: any }, timestamp: string): string[] {
        const lighthouseScores = results.lighthouse?.categories ? {
            performance: Math.round((results.lighthouse.categories.performance?.score || 0) * 100),
            accessibility: Math.round((results.lighthouse.categories.accessibility?.score || 0) * 100),
            seo: Math.round((results.lighthouse.categories.seo?.score || 0) * 100),
            bestPractices: Math.round((results.lighthouse.categories['best-practices']?.score || 0) * 100)
        } : { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 };

        return [
            timestamp, // Timestamp
            results.url, // URL
            results.websiteMonitoring.status, // Website Status
            results.websiteMonitoring.statusCode?.toString() || '', // Status Code
            results.responseTime.value.toString(), // Response Time (ms)
            results.responseTime.status, // Response Time Status
            results.dnsMonitoring.status, // DNS Status
            results.dnsMonitoring.records?.A?.length?.toString() || '0', // A Records Count
            results.dnsMonitoring.records?.MX?.length?.toString() || '0', // MX Records Count
            results.sslMonitoring.status, // SSL Status
            results.sslMonitoring.certificate?.daysUntilExpiry?.toString() || '', // SSL Days Until Expiry
            results.sslMonitoring.certificate?.issuer || '', // SSL Issuer
            results.domainExpiration.status, // Domain Expiration Status
            results.domainExpiration.daysUntilExpiry?.toString() || '', // Domain Days Until Expiry
            results.pingMonitoring.status, // Ping Status
            results.pingMonitoring.responseTime?.toString() || '', // Ping Response Time
            results.keywordMonitoring?.status || '', // Keyword Status
            results.keywordMonitoring?.keyword || '', // Keyword
            results.keywordMonitoring?.occurrences?.toString() || '0', // Keyword Occurrences
            Object.values(results.portMonitoring).filter(p => p.status === 'open').length.toString(), // Open Ports Count
            lighthouseScores.performance.toString(), // Lighthouse Performance
            lighthouseScores.accessibility.toString(), // Lighthouse Accessibility
            lighthouseScores.seo.toString(), // Lighthouse SEO
            lighthouseScores.bestPractices.toString(), // Lighthouse Best Practices
            results.security?.ssl ? 'Enabled' : 'Disabled', // SSL Enabled
            results.network?.log?.entries?.length?.toString() || '0', // Network Requests Count
            results.console?.length?.toString() || '0', // Console Errors Count
            this.getOverallHealthScore(results).toString(), // Overall Health Score
            this.getRecommendations(results) // Recommendations
        ];
    }

    private getOverallHealthScore(results: MonitoringResult & { lighthouse?: any; network?: any; console?: any; security?: any }): number {
        let score = 100;

        // Deduct points for various issues
        if (results.websiteMonitoring.status !== 'online') score -= 30;
        if (results.responseTime.status === 'critical') score -= 20;
        if (results.responseTime.status === 'warning') score -= 10;
        if (results.sslMonitoring.status === 'expired') score -= 25;
        if (results.sslMonitoring.status === 'expiring_soon') score -= 10;
        if (results.domainExpiration.status === 'expired') score -= 25;
        if (results.domainExpiration.status === 'expiring_soon') score -= 10;
        if (results.pingMonitoring.status === 'failed') score -= 15;
        if (results.console?.length > 0) score -= Math.min(results.console.length * 2, 20);

        // Add points for good performance
        if (results.lighthouse?.categories?.performance?.score > 0.9) score += 10;
        if (results.lighthouse?.categories?.accessibility?.score > 0.9) score += 5;
        if (results.lighthouse?.categories?.seo?.score > 0.9) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    private getRecommendations(results: MonitoringResult & { lighthouse?: any; network?: any; console?: any; security?: any }): string {
        const recommendations: string[] = [];

        if (results.websiteMonitoring.status !== 'online') {
            recommendations.push('Website is offline');
        }
        if (results.responseTime.status === 'critical') {
            recommendations.push('Response time is too slow');
        }
        if (results.sslMonitoring.status === 'expired') {
            recommendations.push('SSL certificate has expired');
        }
        if (results.sslMonitoring.status === 'expiring_soon') {
            recommendations.push('SSL certificate expiring soon');
        }
        if (results.domainExpiration.status === 'expired') {
            recommendations.push('Domain has expired');
        }
        if (results.domainExpiration.status === 'expiring_soon') {
            recommendations.push('Domain expiring soon');
        }
        if (results.pingMonitoring.status === 'failed') {
            recommendations.push('Ping failed');
        }
        if (results.console?.length > 0) {
            recommendations.push(`${results.console.length} console errors found`);
        }
        if (results.lighthouse?.categories?.performance?.score < 0.7) {
            recommendations.push('Performance needs improvement');
        }
        if (results.lighthouse?.categories?.accessibility?.score < 0.7) {
            recommendations.push('Accessibility needs improvement');
        }

        return recommendations.length > 0 ? recommendations.join('; ') : 'All systems operational';
    }

    public async createSpreadsheet(title: string): Promise<string | null> {
        if (!this.sheets) {
            throw new Error('Google Sheets not initialized');
        }

        try {
            const response = await this.sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: title
                    },
                    sheets: [
                        {
                            properties: {
                                title: 'Monitoring Results'
                            }
                        }
                    ]
                }
            });

            const spreadsheetId = response.data.spreadsheetId;

            // Set up headers
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'A1:AD1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[
                        'Timestamp',
                        'URL',
                        'Website Status',
                        'Status Code',
                        'Response Time (ms)',
                        'Response Time Status',
                        'DNS Status',
                        'A Records Count',
                        'MX Records Count',
                        'SSL Status',
                        'SSL Days Until Expiry',
                        'SSL Issuer',
                        'Domain Expiration Status',
                        'Domain Days Until Expiry',
                        'Ping Status',
                        'Ping Response Time',
                        'Keyword Status',
                        'Keyword',
                        'Keyword Occurrences',
                        'Open Ports Count',
                        'Lighthouse Performance',
                        'Lighthouse Accessibility',
                        'Lighthouse SEO',
                        'Lighthouse Best Practices',
                        'SSL Enabled',
                        'Network Requests Count',
                        'Console Errors Count',
                        'Overall Health Score',
                        'Recommendations'
                    ]]
                }
            });

            // Format headers
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: 0,
                                    endRowIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.8 },
                                        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        }
                    ]
                }
            });

            return spreadsheetId;
        } catch (error) {
            console.error('Failed to create spreadsheet:', error);
            return null;
        }
    }
} 