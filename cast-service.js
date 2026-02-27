/**
 * cast-service.js — Chromecast / Google Home integration for To-DoX
 */

const os = require('os');
const path = require('path');
const http = require('http');
const fsSync = require('fs');

// ── Local HTTP server ────────────────────────────────────────────────────────
let castServer = null;
let castServerPort = 0;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.webp': 'image/webp',
    '.ttf': 'font/ttf',
};

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function startCastServer(distPath) {
    return new Promise((resolve, reject) => {
        if (castServer) { resolve(castServerPort); return; }

        castServer = http.createServer((req, res) => {
            const urlPath = (req.url || '/').split('?')[0];
            const decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
            const filePath = path.join(distPath, decoded);

            if (!filePath.startsWith(distPath)) {
                res.writeHead(403); res.end('Forbidden'); return;
            }
            try {
                const data = fsSync.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
                res.end(data);
            } catch {
                try {
                    const data = fsSync.readFileSync(path.join(distPath, 'index.html'));
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    res.end(data);
                } catch { res.writeHead(404); res.end('Not found'); }
            }
        });

        castServer.listen(0, '0.0.0.0', () => {
            castServerPort = castServer.address().port;
            console.log(`[CAST] Serveur HTTP local → port ${castServerPort}`);
            resolve(castServerPort);
        });
        castServer.on('error', reject);
    });
}

function stopCastServer() {
    if (castServer) { castServer.close(); castServer = null; castServerPort = 0; }
}

// ── mDNS discovery via multicast-dns (direct, interface-bound) ───────────────

/**
 * Parse les TXT records mDNS (Buffer[]) en objet clé/valeur.
 */
function parseTxt(txtData) {
    const obj = {};
    if (!Array.isArray(txtData)) return obj;
    for (const entry of txtData) {
        const str = Buffer.isBuffer(entry) ? entry.toString('utf8') : String(entry);
        const idx = str.indexOf('=');
        if (idx > 0) obj[str.slice(0, idx).toLowerCase()] = str.slice(idx + 1);
    }
    return obj;
}

function discoverDevices(timeoutMs = 8000) {
    return new Promise((resolve) => {
        let mdns;
        const localIP = getLocalIP();

        try {
            // Bind on the LAN interface explicitly — avoids Windows multicast routing issues
            mdns = require('multicast-dns')({ interface: localIP });
        } catch (e) {
            console.warn('[CAST] multicast-dns non disponible:', e.message);
            resolve([]);
            return;
        }

        const devices = [];
        const seen = new Set();

        // Accumulate records across multiple responses (mDNS is iterative)
        const srvMap  = new Map(); // instance name → { target, port }
        const txtMap  = new Map(); // instance name → parsed txt
        const aMap    = new Map(); // hostname → IPv4

        function tryAssemble() {
            for (const [instance, srv] of srvMap) {
                const host = aMap.get(srv.target) || aMap.get(srv.target.replace(/\.$/, ''));
                if (!host || seen.has(host)) continue;

                const txt = txtMap.get(instance) || {};
                const name = txt.fn || instance.split('._googlecast')[0] || 'Appareil Cast';
                const model = txt.md || 'Google Cast';

                seen.add(host);
                devices.push({ name, host, port: srv.port, model });
                console.log(`[CAST] ✓ ${name} (${model}) @ ${host}:${srv.port}`);
            }
        }

        mdns.on('response', (response) => {
            const all = [...(response.answers || []), ...(response.additionals || [])];

            for (const r of all) {
                if (r.type === 'SRV' && r.name.includes('_googlecast')) {
                    srvMap.set(r.name, { target: r.data.target, port: r.data.port });
                }
                if (r.type === 'TXT' && r.name.includes('_googlecast')) {
                    txtMap.set(r.name, parseTxt(r.data));
                }
                if (r.type === 'A') {
                    aMap.set(r.name, r.data);
                    aMap.set(r.name.replace(/\.$/, ''), r.data);
                }
            }
            tryAssemble();
        });

        mdns.on('error', (err) => {
            console.warn('[CAST] mDNS error:', err.message);
        });

        // Send PTR query for Google Cast services
        mdns.query({ questions: [{ name: '_googlecast._tcp.local', type: 'PTR' }] });

        // Re-query halfway through in case the first packet was lost
        const requery = setTimeout(() => {
            try { mdns.query({ questions: [{ name: '_googlecast._tcp.local', type: 'PTR' }] }); } catch { /* ignore */ }
        }, timeoutMs / 2);

        setTimeout(() => {
            clearTimeout(requery);
            try { mdns.destroy(); } catch { /* ignore */ }
            console.log(`[CAST] Découverte terminée — ${devices.length} appareil(s) trouvé(s)`);
            resolve(devices);
        }, timeoutMs);
    });
}

// ── Cast protocol ────────────────────────────────────────────────────────────

/**
 * Builds a Cast Application class for the given appId.
 * When appId is provided, uses a custom receiver (our cast-receiver.html).
 * Falls back to DefaultMediaReceiver when no appId is provided.
 */
function buildReceiverApp(appId) {
    const castv2 = require('castv2-client');
    if (!appId) return castv2.DefaultMediaReceiver;

    // Extend DefaultMediaReceiver so we inherit media load/play methods,
    // but override the App ID → our custom cast-receiver.html will be launched.
    class CustomReceiver extends castv2.DefaultMediaReceiver {}
    CustomReceiver.APP_ID = appId.trim();
    return CustomReceiver;
}

/**
 * Connect to a Cast device and load `url`.
 *
 * @param {string}  host   - Device IP
 * @param {number}  port   - Device port (default 8009)
 * @param {string}  url    - URL to display (the local app URL)
 * @param {string}  [appId]- Custom Cast App ID (points to cast-receiver.html).
 *                           If omitted, falls back to DefaultMediaReceiver.
 */
function castUrl(host, port, url, appId) {
    let Client;
    try {
        Client = require('castv2-client').Client;
    } catch (e) {
        return Promise.reject(new Error('castv2-client non installé: ' + e.message));
    }

    const ReceiverApp = buildReceiverApp(appId);
    const mode = appId ? `custom (${appId})` : 'DefaultMediaReceiver (fallback)';

    return new Promise((resolve, reject) => {
        const client = new Client();

        const connectTimeout = setTimeout(() => {
            try { client.close(); } catch { /* ignore */ }
            reject(new Error('Timeout de connexion (15s)'));
        }, 15000);

        client.connect({ host, port: port || 8009 }, () => {
            clearTimeout(connectTimeout);
            console.log(`[CAST] Connecté à ${host}:${port || 8009} — mode: ${mode}`);

            client.launch(ReceiverApp, (err, player) => {
                if (err) {
                    try { client.close(); } catch { /* ignore */ }
                    return reject(new Error(`Erreur de lancement: ${err.message}`));
                }

                const media = {
                    contentId: url,
                    contentType: 'text/html',
                    streamType: 'LIVE',
                    metadata: { type: 0, metadataType: 0, title: 'To-DoX' },
                };

                player.load(media, { autoplay: true }, (loadErr, status) => {
                    if (loadErr) {
                        console.warn(`[CAST] Avertissement load: ${loadErr.message}`);
                        // With a custom receiver, a load warning often just means the SDK
                        // intercepted the message (which is intended behaviour).
                        resolve({ success: true, warning: loadErr.message, url, mode });
                        return;
                    }
                    console.log('[CAST] ✅ Cast réussi');
                    resolve({ success: true, status, url, mode });
                });
            });
        });

        client.on('error', (err) => {
            clearTimeout(connectTimeout);
            reject(new Error(`Erreur client Cast: ${err.message}`));
        });
    });
}

module.exports = { discoverDevices, castUrl, getLocalIP, startCastServer, stopCastServer };
