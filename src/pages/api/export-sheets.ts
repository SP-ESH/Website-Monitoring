import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '../../lib/services/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, config, results, spreadsheetTitle } = req.body;

    try {
        const sheetsService = GoogleSheetsService.getInstance();

        switch (action) {
            case 'initialize':
                if (!config) {
                    return res.status(400).json({ error: 'Config is required for initialization' });
                }
                sheetsService.initialize(config);
                return res.status(200).json({ message: 'Google Sheets service initialized successfully' });

            case 'create_spreadsheet':
                if (!spreadsheetTitle) {
                    return res.status(400).json({ error: 'Spreadsheet title is required' });
                }
                const spreadsheetId = await sheetsService.createSpreadsheet(spreadsheetTitle);
                if (spreadsheetId) {
                    return res.status(200).json({
                        message: 'Spreadsheet created successfully',
                        spreadsheetId
                    });
                } else {
                    return res.status(500).json({ error: 'Failed to create spreadsheet' });
                }

            case 'export_results':
                if (!results) {
                    return res.status(400).json({ error: 'Results are required for export' });
                }
                const success = await sheetsService.exportMonitoringResults(results);
                if (success) {
                    return res.status(200).json({ message: 'Results exported to Google Sheets successfully' });
                } else {
                    return res.status(500).json({ error: 'Failed to export results' });
                }

            default:
                return res.status(400).json({ error: 'Invalid action specified' });
        }
    } catch (error: any) {
        console.error('Google Sheets API error:', error);
        return res.status(500).json({
            error: 'Google Sheets operation failed',
            details: error.message
        });
    }
} 