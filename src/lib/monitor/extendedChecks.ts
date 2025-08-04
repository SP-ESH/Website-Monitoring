import dns from 'dns/promises';
import tls from 'tls';
import net from 'net';
import { performance } from 'perf_hooks';
import fetch from 'node-fetch';
import whois from 'whois-json';
import { exec } from 'child_process';

export async function runExtendedChecks(url: string, keyword?: string) {
    const results: Record<string, any> = { url };
    const startTime = performance.now();

    try {
        const response = await fetch(url);
        const endTime = performance.now();
        results.responseTime = `${(endTime - startTime).toFixed(2)} ms`;
        results.statusCode = response.status;

        const headers = response.headers;
        results.ssl = headers.get('strict-transport-security') ? 'Valid' : 'Missing';
        results.securityHeaders = {
            'content-security-policy': headers.get('content-security-policy') || 'Missing',
            'x-frame-options': headers.get('x-frame-options') || 'Missing',
            'x-content-type-options': headers.get('x-content-type-options') || 'Missing',
        };

        const resText = await response.text();
        if (keyword) {
            results.keywordFound = resText.includes(keyword);
        }
    } catch (e) {
        results.error = typeof e === 'object' && e !== null && 'message' in e ? (e as { message: string }).message : String(e);
    }

    // DNS Monitoring
    try {
        const hostname = new URL(url).hostname;
        const dnsRecords = await dns.lookup(hostname);
        results.dns = dnsRecords;
    } catch (e) {
        results.dnsError = typeof e === 'object' && e !== null && 'message' in e ? (e as { message: string }).message : String(e);
    }

    // Domain Expiry Check
    try {
        const domain = new URL(url).hostname;
        const whoisData = await whois(domain) as {
            expiryDate?: string;
            'Registry Expiry Date'?: string;
            expires?: string;
            'Expiration Date'?: string;
            [key: string]: any;
        };
        results.domainExpiry = whoisData?.['expiryDate'] || whoisData?.['Registry Expiry Date'] || whoisData?.['expires'] || whoisData?.['Expiration Date'] || 'Unknown';
    } catch (e) {
        results.domainExpiryError = typeof e === 'object' && e !== null && 'message' in e ? (e as { message: string }).message : String(e);
    }

    // Port Monitoring (80, 443)
    results.ports = {};
    for (const port of [80, 443]) {
        await new Promise((resolve) => {
            const socket = net.createConnection(port, new URL(url).hostname);
            socket.setTimeout(3000);
            socket.on('connect', () => {
                results.ports[port] = 'Open';
                socket.destroy();
                resolve(null);
            });
            socket.on('error', () => {
                results.ports[port] = 'Closed';
                resolve(null);
            });
            socket.on('timeout', () => {
                results.ports[port] = 'Timed Out';
                socket.destroy();
                resolve(null);
            });
        });
    }

    // Ping Monitoring
    results.ping = await new Promise((resolve) => {
        exec(`ping -c 1 ${new URL(url).hostname}`, (err, stdout) => {
            if (err) return resolve('Ping Failed');
            const match = stdout.match(/time=(\d+\.\d+)/);
            resolve(match ? `${match[1]} ms` : 'Ping OK');
        });
    });

    return results;
}
