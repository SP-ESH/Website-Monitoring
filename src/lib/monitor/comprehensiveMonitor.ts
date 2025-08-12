import dns from 'dns/promises';
import tls from 'tls';
import net from 'net';
import { performance } from 'perf_hooks';
import fetch from 'node-fetch';
import whois from 'whois-json';
import { exec } from 'child_process';
import { promisify } from 'util';
// @ts-expect-error: psl types are not resolved correctly due to package.json "exports" field
import psl from 'psl';

const execAsync = promisify(exec);

export interface MonitoringResult {
    url: string;
    timestamp: string;
    websiteMonitoring: {
        status: 'online' | 'offline' | 'error';
        statusCode?: number;
        error?: string;
    };
    responseTime: {
        value: number;
        unit: 'ms';
        status: 'good' | 'warning' | 'critical';
    };
    dnsMonitoring: {
        status: 'resolved' | 'failed' | 'error';
        records?: {
            A?: string[];
            AAAA?: string[];
            MX?: string[];
            TXT?: string[];
            NS?: string[];
        };
        error?: string;
    };
    sslMonitoring: {
        status: 'valid' | 'invalid' | 'expired' | 'expiring_soon' | 'error';
        certificate?: {
            issuer: string;
            validFrom: string;
            validTo: string;
            daysUntilExpiry: number;
        };
        error?: string;
    };
    domainExpiration: {
        status: 'valid' | 'expired' | 'expiring_soon' | 'error';
        expiryDate?: string;
        daysUntilExpiry?: number;
        error?: string;
    };
    portMonitoring: {
        [port: number]: {
            status: 'open' | 'closed' | 'timeout' | 'error';
            responseTime?: number;
        };
    };
    pingMonitoring: {
        status: 'success' | 'failed' | 'error';
        responseTime?: number;
        error?: string;
    };
    keywordMonitoring?: {
        status: 'found' | 'not_found' | 'error';
        keyword?: string;
        occurrences?: number;
        error?: string;
    };
}

export class ComprehensiveMonitor {
    private static instance: ComprehensiveMonitor;

    private constructor() { }

    public static getInstance(): ComprehensiveMonitor {
        if (!ComprehensiveMonitor.instance) {
            ComprehensiveMonitor.instance = new ComprehensiveMonitor();
        }
        return ComprehensiveMonitor.instance;
    }

    async monitorWebsite(url: string, keyword?: string): Promise<MonitoringResult> {
        const result: MonitoringResult = {
            url,
            timestamp: new Date().toISOString(),
            websiteMonitoring: { status: 'error' },
            responseTime: { value: 0, unit: 'ms', status: 'critical' },
            dnsMonitoring: { status: 'error' },
            sslMonitoring: { status: 'error' },
            domainExpiration: { status: 'error' },
            portMonitoring: {},
            pingMonitoring: { status: 'error' }
        };

        // Website and Response Time Monitoring
        await this.monitorWebsiteStatus(url, result);

        // DNS Monitoring
        await this.monitorDNS(url, result);

        // SSL Monitoring
        await this.monitorSSL(url, result);

        // Domain Expiration Monitoring
        await this.monitorDomainExpiration(url, result);

        // Port Monitoring
        await this.monitorPorts(url, result);

        // Ping Monitoring
        await this.monitorPing(url, result);

        // Keyword Monitoring
        if (keyword) {
            await this.monitorKeyword(url, keyword, result);
        }

        return result;
    }

    private async monitorWebsiteStatus(url: string, result: MonitoringResult): Promise<void> {
        try {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Website-Monitor/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            result.websiteMonitoring = {
                status: response.ok ? 'online' : 'offline',
                statusCode: response.status
            };

            result.responseTime = {
                value: Math.round(responseTime),
                unit: 'ms',
                status: responseTime < 1000 ? 'good' : responseTime < 3000 ? 'warning' : 'critical'
            };
        } catch (error) {
            result.websiteMonitoring = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            result.responseTime = {
                value: 0,
                unit: 'ms',
                status: 'critical'
            };
        }
    }

    private async monitorDNS(url: string, result: MonitoringResult): Promise<void> {
        try {
            const hostname = new URL(url).hostname;

            // Use built-in DNS module
            const [aRecords, mxRecords, txtRecords, nsRecords] = await Promise.all([
                dns.resolve4(hostname).catch(() => []),
                dns.resolveMx(hostname).catch(() => []),
                dns.resolveTxt(hostname).catch(() => []),
                dns.resolveNs(hostname).catch(() => [])
            ]);

            result.dnsMonitoring = {
                status: 'resolved',
                records: {
                    A: aRecords,
                    MX: mxRecords.map(mx => mx.exchange),
                    TXT: txtRecords.flat(),
                    NS: nsRecords
                }
            };
        } catch (error) {
            result.dnsMonitoring = {
                status: 'error',
                error: error instanceof Error ? error.message : 'DNS resolution failed'
            };
        }
    }

    private async monitorSSL(url: string, result: MonitoringResult): Promise<void> {
        try {
            const hostname = new URL(url).hostname;
            const port = new URL(url).port || '443';

            const certificate = await new Promise<tls.PeerCertificate>((resolve, reject) => {
                const socket = tls.connect({
                    host: hostname,
                    port: parseInt(port),
                    servername: hostname,
                    rejectUnauthorized: false
                });

                socket.on('secureConnect', () => {
                    const cert = socket.getPeerCertificate();
                    socket.end();
                    resolve(cert);
                });

                socket.on('error', reject);
                socket.setTimeout(5000, () => {
                    socket.destroy();
                    reject(new Error('SSL connection timeout'));
                });
            });

            const now = new Date();
            const validFrom = new Date(certificate.valid_from);
            const validTo = new Date(certificate.valid_to);
            const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            result.sslMonitoring = {
                status: daysUntilExpiry > 0 ? (daysUntilExpiry > 30 ? 'valid' : 'expiring_soon') : 'expired',
                certificate: {
                    issuer: certificate.issuer?.CN || 'Unknown',
                    validFrom: validFrom.toISOString(),
                    validTo: validTo.toISOString(),
                    daysUntilExpiry
                }
            };
        } catch (error) {
            result.sslMonitoring = {
                status: 'error',
                error: error instanceof Error ? error.message : 'SSL check failed'
            };
        }
    }

    // npm install psl
    // ...other imports (dns, tls, net, performance, fetch, execAsync, etc.)

    private async monitorDomainExpiration(url: string, result: MonitoringResult): Promise<void> {
        try {
            const hostname = new URL(url).hostname;

            // 1) Extract registered domain reliably (handles co.uk, etc. with psl)
            const parsed = psl.parse(hostname);
            let domain = typeof parsed === 'object' && parsed.domain ? parsed.domain : null;
            if (!domain) {
                // fallback: last two labels (best-effort)
                const parts = hostname.split('.');
                domain = parts.slice(-2).join('.');
            }

            let expiryStr: string | undefined;

            // Helper: try parse date string into Date object (handles several formats)
            const parseDateString = (s: string): Date | null => {
                if (!s) return null;
                s = s.trim().replace(/\s+GMT$/i, 'Z'); // normalize trailing "GMT"
                const d = new Date(s);
                if (!isNaN(d.getTime())) return d;

                // dd-MMM-YYYY or d-MMM-YYYY (e.g., 20-Jul-2025)
                const m = s.match(/(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ](\d{4})/);
                if (m) {
                    const day = m[1].padStart(2, '0');
                    const mon = m[2].slice(0, 3).toLowerCase();
                    const months: Record<string, string> = {
                        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
                    };
                    if (months[mon]) {
                        const iso = `${m[3]}-${months[mon]}-${day}T00:00:00Z`;
                        const d2 = new Date(iso);
                        if (!isNaN(d2.getTime())) return d2;
                    }
                }

                // last-resort Date.parse
                const parsedMs = Date.parse(s);
                return isNaN(parsedMs) ? null : new Date(parsedMs);
            };

            // 2) Try RDAP (structured JSON) first — usually the most reliable
            try {
                const rdapResp = await fetch(`https://rdap.org/domain/${domain}`, {
                    headers: { 'User-Agent': 'Website-Monitor/1.0' },
                    // node-fetch doesn't support timeout in options prior to v3; if needed wrap in AbortController
                });

                if (rdapResp.ok) {
                    const rdapJson = await rdapResp.json().catch(() => null);
                    if (rdapJson) {
                        // RDAP typically contains an "events" array with eventAction and eventDate
                        if (Array.isArray(rdapJson.events)) {
                            const expEvent = rdapJson.events.find((e: any) =>
                                typeof e.eventAction === 'string' &&
                                /expir|expiration|expire/i.test(e.eventAction)
                            );
                            if (expEvent && expEvent.eventDate) {
                                expiryStr = String(expEvent.eventDate).trim();
                            }
                        }

                        // Some RDAP servers might embed the expiry in different places:
                        if (!expiryStr && Array.isArray(rdapJson.nameservers)) {
                            // nothing to do here, but left as placeholder in case of custom RDAP fields
                        }
                    }
                }
            } catch (err) {
                // RDAP failed (network or service) -> fall through to whois fallback
            }

            // 3) If RDAP didn't find expiry, fallback to raw whois and search multiple patterns
            if (!expiryStr) {
                const { stdout, stderr } = await execAsync(`whois ${domain}`);
                const whoisText = (stdout || '') + '\n' + (stderr || '');

                const patterns = [
                    /Registry Expiry Date:\s*(.+)/i,
                    /Registrar Registration Expiration Date:\s*(.+)/i,
                    /Expiration Date:\s*(.+)/i,
                    /Expiry Date:\s*(.+)/i,
                    /paid-till:\s*(.+)/i,
                    /paid_till:\s*(.+)/i,
                    /Expires On:\s*(.+)/i,
                    /expires:\s*(.+)/i,
                    /Renewal Date:\s*(.+)/i,
                    /domain_datebilled_until:\s*(.+)/i,
                    /Registry Expiry:\s*(.+)/i
                ];

                for (const re of patterns) {
                    const m = whoisText.match(re);
                    if (m && m[1]) {
                        expiryStr = m[1].trim();
                        break;
                    }
                }

                // if still not found, try a looser search: any line containing "expir" or "expire"
                if (!expiryStr) {
                    const loose = whoisText.split(/\r?\n/).find(line => /expir|expire|expiry|expires/i.test(line));
                    if (loose) {
                        // take part after colon if exists
                        const parts = loose.split(':');
                        if (parts.length > 1) expiryStr = parts.slice(1).join(':').trim();
                        else expiryStr = loose.trim();
                    }
                }

                // For debugging (optional): include a short snippet of whois output in the error
                if (!expiryStr) {
                    result.domainExpiration = {
                        status: 'error',
                        error: 'Could not find expiry date in RDAP or WHOIS output; sample WHOIS start: ' + whoisText.slice(0, 800)
                    };
                    return;
                }
            }

            // 4) Parse the discovered expiry string into a Date
            const expiryDate = parseDateString(expiryStr);
            if (!expiryDate) {
                result.domainExpiration = {
                    status: 'error',
                    error: `Found expiry string but could not parse it: "${expiryStr}"`
                };
                return;
            }

            const now = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            result.domainExpiration = {
                status: daysUntilExpiry > 0 ? (daysUntilExpiry > 30 ? 'valid' : 'expiring_soon') : 'expired',
                expiryDate: expiryDate.toISOString(),
                daysUntilExpiry
            };
        } catch (error) {
            result.domainExpiration = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Domain expiration check failed'
            };
        }
    }


    private async monitorPorts(url: string, result: MonitoringResult): Promise<void> {
        const hostname = new URL(url).hostname;
        const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 5432, 8080];

        for (const port of ports) {
            try {
                const startTime = performance.now();
                const isOpen = await new Promise<boolean>((resolve) => {
                    const socket = net.createConnection(port, hostname);
                    socket.setTimeout(3000);

                    socket.on('connect', () => {
                        const endTime = performance.now();
                        result.portMonitoring[port] = {
                            status: 'open',
                            responseTime: Math.round(endTime - startTime)
                        };
                        socket.destroy();
                        resolve(true);
                    });

                    socket.on('error', () => {
                        result.portMonitoring[port] = { status: 'closed' };
                        resolve(false);
                    });

                    socket.on('timeout', () => {
                        result.portMonitoring[port] = { status: 'timeout' };
                        socket.destroy();
                        resolve(false);
                    });
                });
            } catch (error) {
                result.portMonitoring[port] = {
                    status: 'error'
                };
            }
        }
    }

    private async monitorPing(url: string, result: MonitoringResult): Promise<void> {
        try {
            const hostname = new URL(url).hostname;

            // Use system ping command
            const { stdout } = await execAsync(`ping -c 1 ${hostname}`);
            const match = stdout.match(/time=(\d+\.\d+)/);

            if (match) {
                result.pingMonitoring = {
                    status: 'success',
                    responseTime: parseFloat(match[1])
                };
            } else {
                result.pingMonitoring = {
                    status: 'failed'
                };
            }
        } catch (error) {
            result.pingMonitoring = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Ping failed'
            };
        }
    }

    private async monitorKeyword(url: string, keyword: string, result: MonitoringResult): Promise<void> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Website-Monitor/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                result.keywordMonitoring = {
                    status: 'error',
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
                return;
            }

            const content = await response.text();
            const occurrences = (content.match(new RegExp(keyword, 'gi')) || []).length;

            result.keywordMonitoring = {
                status: occurrences > 0 ? 'found' : 'not_found',
                keyword,
                occurrences
            };
        } catch (error) {
            result.keywordMonitoring = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Keyword monitoring failed'
            };
        }
    }
} 