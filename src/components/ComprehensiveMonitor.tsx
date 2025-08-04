import { useState } from "react";
import { MonitoringResult } from "../lib/monitor/comprehensiveMonitor";

interface MonitoringJob {
    id: string;
    config: {
        url: string;
        keyword?: string;
        schedule: string;
    };
    lastRun?: string;
    isActive: boolean;
}

export default function ComprehensiveMonitor() {
    const [url, setUrl] = useState("");
    const [keyword, setKeyword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [results, setResults] = useState<MonitoringResult | null>(null);
    const [jobs, setJobs] = useState<MonitoringJob[]>([]);
    const [activeTab, setActiveTab] = useState<'monitor' | 'scheduled'>('monitor');
    const [sheetsConfig, setSheetsConfig] = useState({
        spreadsheetId: '',
        clientEmail: '',
        privateKey: ''
    });
    const [showSheetsConfig, setShowSheetsConfig] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleMonitor = async () => {
        if (!url.trim()) {
            alert('Please enter a website URL');
            return;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            alert('Please enter a valid URL (e.g., https://example.com)');
            return;
        }

        setIsLoading(true);
        setIsMonitoring(true);

        // Create abort controller for this monitoring session
        const controller = new AbortController();
        setAbortController(controller);

        try {
            const response = await fetch('/api/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, keyword: keyword || undefined }),
                signal: controller.signal
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                alert('Monitoring stopped by user');
            } else {
                alert('Failed to monitor website');
            }
        } finally {
            setIsLoading(false);
            setIsMonitoring(false);
            setAbortController(null);
        }
    };

    const stopMonitoring = () => {
        if (abortController) {
            abortController.abort();
            setIsLoading(false);
            setIsMonitoring(false);
            setAbortController(null);
        }
    };

    const loadScheduledJobs = async () => {
        try {
            const response = await fetch('/api/scheduled-monitor');
            if (response.ok) {
                const data = await response.json();
                setJobs(data.jobs || []);
            }
        } catch (error) {
            console.error('Failed to load scheduled jobs');
        }
    };

    const addScheduledJob = async (jobId: string, schedule: string) => {
        try {
            const response = await fetch('/api/scheduled-monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: jobId,
                    config: {
                        url,
                        keyword: keyword || undefined,
                        schedule
                    }
                })
            });

            if (response.ok) {
                alert('Scheduled job added successfully');
                loadScheduledJobs();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to add scheduled job');
        }
    };

    const runJobNow = async (jobId: string) => {
        try {
            const response = await fetch('/api/run-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId })
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data.result);
                alert('Job executed successfully');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to run job');
        }
    };

    const removeJob = async (jobId: string) => {
        try {
            const response = await fetch(`/api/scheduled-monitor?id=${jobId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Job removed successfully');
                loadScheduledJobs();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to remove job');
        }
    };

    const initializeGoogleSheets = async () => {
        try {
            const response = await fetch('/api/export-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'initialize',
                    config: {
                        spreadsheetId: sheetsConfig.spreadsheetId,
                        credentials: {
                            client_email: sheetsConfig.clientEmail,
                            private_key: sheetsConfig.privateKey
                        }
                    }
                })
            });

            if (response.ok) {
                alert('Google Sheets configured successfully');
                setShowSheetsConfig(false);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to configure Google Sheets');
        }
    };

    const createSpreadsheet = async () => {
        try {
            const response = await fetch('/api/export-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_spreadsheet',
                    spreadsheetTitle: `Website Monitoring - ${new Date().toLocaleDateString()}`
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSheetsConfig(prev => ({ ...prev, spreadsheetId: data.spreadsheetId }));
                alert(`Spreadsheet created successfully! ID: ${data.spreadsheetId}`);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to create spreadsheet');
        }
    };

    const exportToSheets = async () => {
        if (!results) return;

        setIsExporting(true);
        try {
            const response = await fetch('/api/export-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'export_results',
                    results: results
                })
            });

            if (response.ok) {
                alert('Results exported to Google Sheets successfully!');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to export to Google Sheets');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
                <div className="flex space-x-4 mb-4">
                    <button
                        onClick={() => setActiveTab('monitor')}
                        className={`px-4 py-2 rounded ${activeTab === 'monitor' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}
                    >
                        Monitor Now
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('scheduled');
                            loadScheduledJobs();
                        }}
                        className={`px-4 py-2 rounded ${activeTab === 'scheduled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}
                    >
                        Scheduled Monitoring
                    </button>
                    <button
                        onClick={() => setShowSheetsConfig(!showSheetsConfig)}
                        className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                    >
                        ⚙️ Google Sheets Config
                    </button>
                </div>

                {/* Google Sheets Configuration */}
                {showSheetsConfig && (
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h3 className="text-xl font-bold mb-4">Google Sheets Configuration</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Spreadsheet ID (optional)</label>
                                <input
                                    type="text"
                                    value={sheetsConfig.spreadsheetId}
                                    onChange={(e) => setSheetsConfig(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                                    placeholder="Leave empty to create new spreadsheet"
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Service Account Email</label>
                                <input
                                    type="email"
                                    value={sheetsConfig.clientEmail}
                                    onChange={(e) => setSheetsConfig(prev => ({ ...prev, clientEmail: e.target.value }))}
                                    placeholder="your-service-account@project.iam.gserviceaccount.com"
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Private Key</label>
                                <textarea
                                    value={sheetsConfig.privateKey}
                                    onChange={(e) => setSheetsConfig(prev => ({ ...prev, privateKey: e.target.value }))}
                                    placeholder="-----BEGIN PRIVATE KEY-----..."
                                    className="w-full p-3 border rounded-lg h-32"
                                />
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    onClick={initializeGoogleSheets}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Initialize Sheets
                                </button>
                                <button
                                    onClick={createSpreadsheet}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    Create New Spreadsheet
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {activeTab === 'monitor' && (
                <div className="space-y-6 text-black">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-2xl font-bold mb-4 ">Website Monitoring</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Website URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className={`w-full p-3 border rounded-lg ${url.trim() === '' ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                                        }`}
                                    required
                                />
                                {url.trim() === '' && (
                                    <p className="text-red-500 text-sm mt-1">Please enter a website URL to start monitoring</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Keyword to Monitor (Optional)</label>
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="Enter keyword to search for"
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleMonitor}
                                    disabled={isLoading || !url.trim()}
                                    className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Monitoring...
                                        </span>
                                    ) : (
                                        'Start Monitoring'
                                    )}
                                </button>
                                {isMonitoring && (
                                    <button
                                        onClick={stopMonitoring}
                                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                                    >
                                        <span>⏹️</span>
                                        <span>Stop</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {results && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Monitoring Results</h3>
                                <button
                                    onClick={exportToSheets}
                                    disabled={isExporting}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                                >
                                    {isExporting ? (
                                        <>
                                            <span>⏳</span>
                                            <span>Exporting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>📊</span>
                                            <span>Export to Google Sheets</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <MonitoringResults results={results} />
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'scheduled' && (
                <div className="space-y-6 text-black">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-2xl font-bold mb-4">Scheduled Monitoring</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Website URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className={`w-full p-3 border rounded-lg ${url.trim() === '' ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                                        }`}
                                />
                                {url.trim() === '' && (
                                    <p className="text-red-500 text-sm mt-1">Please enter a website URL to schedule monitoring</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Keyword to Monitor (Optional)</label>
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="Enter keyword to search for"
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Schedule (Cron Expression) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="*/5 * * * * (every 5 minutes)"
                                    className="w-full p-3 border rounded-lg border-gray-300 focus:border-blue-500"
                                    id="scheduleInput"
                                />
                                <p className="text-gray-600 text-sm mt-1">
                                    Examples: */5 * * * * (every 5 min), 0 */6 * * * (every 6 hours), 0 0 * * * (daily)
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const schedule = (document.getElementById('scheduleInput') as HTMLInputElement).value;

                                    if (!url.trim()) {
                                        alert('Please enter a website URL');
                                        return;
                                    }

                                    // Validate URL format
                                    try {
                                        new URL(url);
                                    } catch {
                                        alert('Please enter a valid URL (e.g., https://example.com)');
                                        return;
                                    }

                                    if (!schedule.trim()) {
                                        alert('Please enter a schedule (cron expression)');
                                        return;
                                    }

                                    addScheduledJob(`job_${Date.now()}`, schedule);
                                }}
                                disabled={!url.trim()}
                                className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Scheduled Job
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4">Active Jobs</h3>
                        <div className="space-y-4">
                            {jobs.map((job) => (
                                <div key={job.id} className="border p-4 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{job.config.url}</p>
                                            <p className="text-sm text-gray-800">Schedule: {job.config.schedule}</p>
                                            {job.config.keyword && (
                                                <p className="text-sm text-gray-800">Keyword: {job.config.keyword}</p>
                                            )}
                                            {job.lastRun && (
                                                <p className="text-sm text-gray-800">Last run: {new Date(job.lastRun).toLocaleString()}</p>
                                            )}
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => runJobNow(job.id)}
                                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                                            >
                                                Run Now
                                            </button>
                                            <button
                                                onClick={() => removeJob(job.id)}
                                                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {jobs.length === 0 && (
                                <p className="text-gray-700">No scheduled jobs found</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MonitoringResults({ results }: { results: MonitoringResult & { lighthouse?: any; network?: any; console?: any; security?: any } }) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
            case 'good':
            case 'valid':
            case 'success':
            case 'resolved':
                return 'text-green-600';
            case 'warning':
            case 'expiring_soon':
                return 'text-yellow-600';
            case 'offline':
            case 'critical':
            case 'expired':
            case 'failed':
            case 'error':
                return 'text-red-600';
            default:
                return 'text-gray-800';
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Monitoring Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Website Status */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">Website Status</h3>
                    <p className={`${getStatusColor(results.websiteMonitoring.status)}`}>
                        {results.websiteMonitoring.status.toUpperCase()}
                    </p>
                    {results.websiteMonitoring.statusCode && (
                        <p className="text-sm text-gray-800">Status Code: {results.websiteMonitoring.statusCode}</p>
                    )}
                </div>

                {/* Response Time */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">Response Time</h3>
                    <p className={`${getStatusColor(results.responseTime.status)}`}>
                        {results.responseTime.value} {results.responseTime.unit}
                    </p>
                    <p className="text-sm text-gray-800">Status: {results.responseTime.status}</p>
                </div>

                {/* DNS Monitoring */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">DNS Status</h3>
                    <p className={`${getStatusColor(results.dnsMonitoring.status)}`}>
                        {results.dnsMonitoring.status.toUpperCase()}
                    </p>
                    {results.dnsMonitoring.records && (
                        <div className="text-sm text-gray-800 mt-2">
                            <p>A Records: {results.dnsMonitoring.records.A?.length || 0}</p>
                            <p>MX Records: {results.dnsMonitoring.records.MX?.length || 0}</p>
                        </div>
                    )}
                </div>

                {/* SSL Monitoring */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">SSL Certificate</h3>
                    <p className={`${getStatusColor(results.sslMonitoring.status)}`}>
                        {results.sslMonitoring.status.toUpperCase()}
                    </p>
                    {results.sslMonitoring.certificate && (
                        <div className="text-sm text-gray-800 mt-2">
                            <p>Issuer: {results.sslMonitoring.certificate.issuer}</p>
                            <p>Expires: {results.sslMonitoring.certificate.daysUntilExpiry} days</p>
                        </div>
                    )}
                </div>

                {/* Domain Expiration */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">Domain Expiration</h3>
                    <p className={`${getStatusColor(results.domainExpiration.status)}`}>
                        {results.domainExpiration.status.toUpperCase()}
                    </p>
                    {results.domainExpiration.daysUntilExpiry && (
                        <p className="text-sm text-gray-800">
                            {results.domainExpiration.daysUntilExpiry} days remaining
                        </p>
                    )}
                </div>

                {/* Ping Monitoring */}
                <div className="border p-4 rounded-lg">
                    <h3 className="font-bold mb-2">Ping Status</h3>
                    <p className={`${getStatusColor(results.pingMonitoring.status)}`}>
                        {results.pingMonitoring.status.toUpperCase()}
                    </p>
                    {results.pingMonitoring.responseTime && (
                        <p className="text-sm text-gray-800">
                            Response: {results.pingMonitoring.responseTime}ms
                        </p>
                    )}
                </div>

                {/* Keyword Monitoring */}
                {results.keywordMonitoring && (
                    <div className="border p-4 rounded-lg">
                        <h3 className="font-bold mb-2">Keyword Monitoring</h3>
                        <p className={`${getStatusColor(results.keywordMonitoring.status)}`}>
                            {results.keywordMonitoring.status.toUpperCase()}
                        </p>
                        {results.keywordMonitoring.keyword && (
                            <p className="text-sm text-gray-800">
                                Keyword: "{results.keywordMonitoring.keyword}"
                            </p>
                        )}
                        {results.keywordMonitoring.occurrences !== undefined && (
                            <p className="text-sm text-gray-800">
                                Occurrences: {results.keywordMonitoring.occurrences}
                            </p>
                        )}
                    </div>
                )}

                {/* Port Monitoring */}
                <div className="border p-4 rounded-lg col-span-full">
                    <h3 className="font-bold mb-2">Port Status</h3>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {Object.entries(results.portMonitoring).map(([port, status]) => (
                            <div key={port} className="text-center">
                                <p className="text-sm font-medium">Port {port}</p>
                                <p className={`text-xs ${getStatusColor(status.status)}`}>
                                    {status.status}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lighthouse Performance */}
                {results.lighthouse && !results.lighthouse.error && (
                    <div className="border p-4 rounded-lg col-span-full">
                        <h3 className="font-bold mb-2">Lighthouse Performance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['performance', 'accessibility', 'seo', 'best-practices'].map((key) => (
                                <div key={key} className="flex flex-col items-center p-3 rounded bg-gray-100">
                                    <p className="text-sm capitalize text-gray-800">{key}</p>
                                    <span className="text-lg font-bold text-gray-900">
                                        {results.lighthouse.categories?.[key]?.score ? Math.round(results.lighthouse.categories[key].score * 100) : 'N/A'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Security Headers */}
                {results.security && !results.security.error && (
                    <div className="border p-4 rounded-lg col-span-full">
                        <h3 className="font-bold mb-2">Security Headers</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col items-center p-3 rounded bg-gray-100">
                                <p className="text-sm text-gray-800">SSL</p>
                                <span className={results.security.ssl ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                                    {results.security.ssl ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded bg-gray-100">
                                <p className="text-sm text-gray-800">Status Code</p>
                                <span className="font-bold text-gray-900">{results.security.status || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded bg-gray-100">
                                <p className="text-sm text-gray-800">Network Requests</p>
                                <span className="font-bold text-blue-700">{results.network?.log?.entries?.length || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded bg-gray-100">
                                <p className="text-sm text-gray-800">JS Errors</p>
                                <span className="font-bold text-red-700">{results.console?.length || 0}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Console Logs */}
                {results.console && results.console.length > 0 && (
                    <div className="border p-4 rounded-lg col-span-full">
                        <h3 className="font-bold mb-2">Console Logs</h3>
                        <details className="mt-4">
                            <summary className="font-medium cursor-pointer text-gray-900">🔍 View Console Logs</summary>
                            <pre className="bg-gray-900 text-green-300 p-4 mt-2 rounded max-h-64 overflow-auto text-sm">
                                {results.console.join('\n') || 'No logs'}
                            </pre>
                        </details>
                    </div>
                )}

                {/* Network Activity */}
                {results.network && results.network.log && (
                    <div className="border p-4 rounded-lg col-span-full">
                        <h3 className="font-bold mb-2">Network Activity</h3>
                        <details>
                            <summary className="font-medium cursor-pointer text-gray-900">🌐 View Network Activity (HAR)</summary>
                            <pre className="bg-gray-900 text-yellow-200 p-4 mt-2 rounded max-h-64 overflow-auto text-sm">
                                {JSON.stringify(results.network.log.entries?.slice(0, 10), null, 2) || 'No network logs'}
                            </pre>
                            <p className="text-xs text-gray-500">(Showing first 10 entries)</p>
                        </details>
                    </div>
                )}
            </div>

            <div className="mt-6">
                <details className="border rounded-lg">
                    <summary className="p-4 cursor-pointer font-medium">Raw Data</summary>
                    <pre className="p-4 bg-gray-100 text-sm overflow-auto">
                        {JSON.stringify(results, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
} 