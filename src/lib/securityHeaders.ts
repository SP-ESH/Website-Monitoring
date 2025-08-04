import fetch from 'node-fetch';

export async function fetchSecurityHeaders(url: string) {
    const res = await fetch(url);
    return {
        headers: res.headers.raw(),
        status: res.status,
        ssl: url.startsWith('https'),
    };
}
