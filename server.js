import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fsp from 'fs/promises';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(compression());

const dataDir = path.join(__dirname, 'data');
const playlistsDir = path.join(dataDir, 'playlists');
const logsDir = path.join(dataDir, 'logs');

function ensureDirsSync() {
	if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
	if (!fs.existsSync(playlistsDir)) fs.mkdirSync(playlistsDir);
	if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
}
ensureDirsSync();

// ---- Simple in-memory ring buffers for logs ----
const MAX_LOGS = 500;
let serverLogs = [];
let clientLogs = [];
function pushLog(buffer, entry) {
	buffer.push(entry);
	if (buffer.length > MAX_LOGS) buffer.shift();
}
function logServer(message, meta = {}) {
	const entry = { ts: new Date().toISOString(), level: 'info', message, ...meta };
	pushLog(serverLogs, entry);
	// Silence console output for regular info logs to reduce noise
}

// Removed per-user request to reduce verbose console logs

app.use(express.static(path.join(__dirname, 'public'), {
	setHeaders: (res, filePath) => {
		// Allow embedding external sites in iframe; do not add restrictive CSP here.
		// Users should ensure target sites permit framing (X-Frame-Options / CSP on target).
		res.removeHeader?.('X-Frame-Options');
		// Cache policy: HTML no cache; JS short; CSS/images long
		if (filePath.endsWith('.html')) {
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
		} else if (filePath.endsWith('.js')) {
			res.setHeader('Cache-Control', 'no-cache');
		} else if (filePath.endsWith('.css') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg') || filePath.endsWith('.webp')) {
			res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
		}
	}
}));

app.get('/', (_req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health endpoint
app.get('/healthz', (_req, res) => {
	res.json({ ok: true, uptime: process.uptime() });
});

// ---- Playlists API ----
// A playlist file is JSON: { name: string, sites: string[], intervalMs?: number, inactivityMs?: number, reloadPolicy?: 'cache'|'reload', countdownEnabled?: boolean }

function toSafeName(name) {
	return String(name).trim().replace(/[^a-z0-9-_ ]/gi, '_');
}
function playlistPath(name) {
	return path.join(playlistsDir, `${name}.json`);
}

app.get('/api/playlists', async (_req, res) => {
	try {
		const files = await fsp.readdir(playlistsDir);
		const names = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
		logServer('playlists:list', { count: names.length });
		res.json({ playlists: names });
	} catch (e) {
		logServer('playlists:list:error', { error: String(e) });
		res.status(500).json({ error: 'Failed to list playlists' });
	}
});

app.get('/api/playlists/:name', async (req, res) => {
	const name = toSafeName(req.params.name);
	try {
		const file = await fsp.readFile(playlistPath(name), 'utf8');
		const parsed = JSON.parse(file);
		logServer('playlists:get', { name });
		res.json(parsed);
	} catch {
		logServer('playlists:get:not_found', { name });
		res.status(404).json({ error: 'Playlist not found' });
	}
});

app.post('/api/playlists', async (req, res) => {
	const { name, sites = [], intervalMs, inactivityMs, reloadPolicy, countdownEnabled } = req.body || {};
	if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Name required' });
	const safe = toSafeName(name);
	const p = playlistPath(safe);
	try {
		await fsp.access(p).then(() => true).catch(() => false);
		// If exists, reject
		if (fs.existsSync(p)) return res.status(409).json({ error: 'Playlist exists' });
		const data = {
			name: safe,
			sites: Array.isArray(sites) ? sites : [],
			...(typeof intervalMs === 'number' ? { intervalMs } : {}),
			...(typeof inactivityMs === 'number' ? { inactivityMs } : {}),
			...(reloadPolicy === 'cache' || reloadPolicy === 'reload' ? { reloadPolicy } : {}),
			...(typeof countdownEnabled === 'boolean' ? { countdownEnabled } : {})
		};
		await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
		logServer('playlists:create', { name: safe, sites: data.sites.length });
		res.status(201).json(data);
	} catch {
		logServer('playlists:create:error', { name: safe });
		res.status(500).json({ error: 'Failed to create playlist' });
	}
});

app.put('/api/playlists/:name', async (req, res) => {
	const name = toSafeName(req.params.name);
	const p = playlistPath(name);
	try {
		const exists = fs.existsSync(p);
		if (!exists) return res.status(404).json({ error: 'Playlist not found' });
		const file = await fsp.readFile(p, 'utf8');
		const current = JSON.parse(file);
		const { sites, intervalMs, inactivityMs, reloadPolicy, countdownEnabled } = req.body || {};
		if (sites && !Array.isArray(sites)) return res.status(400).json({ error: 'sites must be array' });
		const updated = {
			...current,
			...(Array.isArray(sites) ? { sites } : {}),
			...(typeof intervalMs === 'number' ? { intervalMs } : {}),
			...(typeof inactivityMs === 'number' ? { inactivityMs } : {}),
			...((reloadPolicy === 'cache' || reloadPolicy === 'reload') ? { reloadPolicy } : {}),
			...(typeof countdownEnabled === 'boolean' ? { countdownEnabled } : {})
		};
		await fsp.writeFile(p, JSON.stringify(updated, null, 2), 'utf8');
		logServer('playlists:update', { name, sites: updated.sites?.length || 0 });
		res.json(updated);
	} catch {
		logServer('playlists:update:error', { name });
		res.status(500).json({ error: 'Failed to update playlist' });
	}
});

app.delete('/api/playlists/:name', async (req, res) => {
	const name = toSafeName(req.params.name);
	try {
		await fsp.unlink(playlistPath(name));
		logServer('playlists:delete', { name });
		res.json({ ok: true });
	} catch {
		logServer('playlists:delete:not_found', { name });
		res.status(404).json({ error: 'Playlist not found' });
	}
});

// ---- Logs API ----
app.get('/api/logs', (_req, res) => {
	res.json({
		server: serverLogs,
		client: clientLogs
	});
});
app.post('/api/logs', (req, res) => {
	const { level = 'info', message = '', meta = {} } = req.body || {};
	const entry = { ts: new Date().toISOString(), level, message, meta };
	pushLog(clientLogs, entry);
	// Do not mirror client logs to console/logServer to avoid spam
	res.json({ ok: true });
});

app.listen(PORT, () => {
	console.log(`Dashboard Revolver running on http://localhost:${PORT}`);
});

// Crash safety logging
process.on('uncaughtException', (err) => {
	try {
		console.error('uncaughtException', err);
		pushLog(serverLogs, { ts: new Date().toISOString(), level: 'error', message: 'uncaughtException', error: String(err) });
	} finally {
		// do not exit for kiosk-style resilience; in real prod consider a process manager
	}
});
process.on('unhandledRejection', (reason) => {
	try {
		console.error('unhandledRejection', reason);
		pushLog(serverLogs, { ts: new Date().toISOString(), level: 'error', message: 'unhandledRejection', error: String(reason) });
	} finally {
		// keep process alive
	}
});


