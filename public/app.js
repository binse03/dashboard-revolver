const DEFAULT_SITES = [
	'https://www.bbc.com',
	'https://www.tagesschau.de',
	'https://www.wikipedia.org'
];
const STORAGE_KEYS = {
	currentPlaylist: 'dashboardRevolver.currentPlaylist'
};

const iframe = document.getElementById('viewport');
const modal = document.getElementById('settings-modal');
const closeBtn = document.getElementById('close-modal');
const settingsButton = document.getElementById('settings-button');
const pauseIndicator = document.getElementById('pause-indicator');
const countdownIndicator = document.getElementById('countdown-indicator');
const reloadButton = document.getElementById('reload-button');
const urlIndicator = document.getElementById('url-indicator');
const gestureEdge = document.getElementById('gesture-edge');
const openLogsBtn = document.getElementById('open-logs');
const logsModal = document.getElementById('logs-modal');
const closeLogsBtn = document.getElementById('close-logs');
const refreshLogsBtn = document.getElementById('refresh-logs');
const downloadLogsBtn = document.getElementById('download-logs');
const clientLogsPre = document.getElementById('client-logs');
const serverLogsPre = document.getElementById('server-logs');
const arrowLeft = document.getElementById('arrow-left');
const arrowRight = document.getElementById('arrow-right');
const addBtn = document.getElementById('add-site');
const urlInput = document.getElementById('site-url');
const siteList = document.getElementById('site-list');
const intervalInput = document.getElementById('interval-seconds');
const applyIntervalBtn = document.getElementById('apply-interval');
const inactivityInput = document.getElementById('inactivity-seconds');
const applyInactivityBtn = document.getElementById('apply-inactivity');
const reloadSelect = document.getElementById('reload-policy');
const applyReloadBtn = document.getElementById('apply-reload');
const shuffleNowBtn = document.getElementById('shuffle-now');
const clearAllBtn = document.getElementById('clear-all');
const playlistSelect = document.getElementById('playlist-select');
const createPlaylistBtn = document.getElementById('create-playlist');
const newPlaylistNameInput = document.getElementById('new-playlist-name');
const deletePlaylistBtn = document.getElementById('delete-playlist');
const themeSelect = document.getElementById('theme-select');
const applyThemeBtn = document.getElementById('apply-theme');

let playlists = [];
let currentPlaylist = null; // { name, sites, intervalMs? }
let sites = []; // from currentPlaylist
let currentIndex = 0;
let intervalMs = 30000; // may come from playlist
let rotationTimer = null;
let lastShownAt = 0;
let isPaused = false;
let autoResumeTimer = null;
let noPauseUntilTs = 0; // buffer to avoid immediate re-pausing after resume
let inactivityMs = 15000;
let reloadPolicy = 'cache'; // 'cache' | 'reload'
let countdownTimer = null;
let nextSwitchAt = 0;
let countdownEnabled = true;
let theme = localStorage.getItem('dashboardRevolver.theme') || 'system'; // 'system' | 'dark' | 'light'
// Allow per-site durations (ms) by supporting site entries as string | { url, durationMs? }
function getSiteEntry(index) {
	const raw = sites[index];
	if (!raw) return null;
	if (typeof raw === 'string') return { url: raw };
	if (raw && typeof raw === 'object') return { url: String(raw.url || ''), durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined };
	return null;
}
function getCurrentDurationMs() {
	const entry = getSiteEntry(currentIndex);
	if (entry && typeof entry.durationMs === 'number' && entry.durationMs >= 5000) return entry.durationMs;
	return intervalMs;
}

// ---- i18n (defensive, loads JSON, safe DOM writes) ----
const languageSelect = document.getElementById('language-select');
const applyLanguageBtn = document.getElementById('apply-language');
let language = localStorage.getItem('dashboardRevolver.lang') || 'de';
let I18N = null;
let I18N_CACHE = {};

async function loadI18n(lang) {
	try {
		if (I18N_CACHE[lang]) {
			I18N = I18N_CACHE[lang];
			return;
		}
		const res = await fetch(`/lang/${lang}.json`, { cache: 'no-cache' });
		if (!res.ok) throw new Error('lang not found');
		const json = await res.json();
		I18N_CACHE[lang] = json;
		I18N = json;
	} catch {
		I18N = I18N_CACHE['de'] || {};
	}
}
function tr(k) { return (I18N && I18N[k]) || k; }

function applyTranslations() {
	try {
		const h2 = document.querySelector('h2');
		if (h2) h2.textContent = tr('settings');
		const firstH3 = document.querySelector('.modal-section h3');
		if (firstH3) firstH3.textContent = tr('playlist');
		const lblInterval = document.querySelector('label[for="interval-seconds"]');
		if (lblInterval) lblInterval.textContent = tr('rotationSeconds');
		const lblInactivity = document.querySelector('label[for="inactivity-seconds"]');
		if (lblInactivity) lblInactivity.textContent = tr('inactivitySeconds');
		const lblReload = document.querySelector('label[for="reload-policy"]');
		if (lblReload) lblReload.textContent = tr('reloadPolicy');
		// Reload policy option texts
		const optCache = document.querySelector('#reload-policy option[value="cache"]');
		if (optCache) optCache.textContent = tr('reloadCache');
		const optReload = document.querySelector('#reload-policy option[value="reload"]');
		if (optReload) optReload.textContent = tr('reloadAlways');
		const lblLang = document.querySelector('label[for="language-select"]');
		if (lblLang) lblLang.textContent = tr('languageLabel');
		const lblCountdown = document.querySelector('label[for="countdown-enabled"]');
		if (lblCountdown) lblCountdown.textContent = tr('countdownLabel');
		const btnApplyInterval = document.getElementById('apply-interval');
		if (btnApplyInterval) btnApplyInterval.textContent = tr('apply');
		const btnApplyInactivity = document.getElementById('apply-inactivity');
		if (btnApplyInactivity) btnApplyInactivity.textContent = tr('apply');
		const btnApplyReload = document.getElementById('apply-reload');
		if (btnApplyReload) btnApplyReload.textContent = tr('apply');
		const btnApplyLanguage = document.getElementById('apply-language');
		if (btnApplyLanguage) btnApplyLanguage.textContent = tr('apply');
		const btnDeletePl = document.getElementById('delete-playlist');
		if (btnDeletePl) btnDeletePl.textContent = tr('delete');
		const btnCreatePl = document.getElementById('create-playlist');
		if (btnCreatePl) btnCreatePl.textContent = tr('create');
		const btnOpenLogs = document.getElementById('open-logs');
		if (btnOpenLogs) btnOpenLogs.textContent = tr('logs');
		if (settingsButton) settingsButton.setAttribute('title', tr('openSettings'));
		if (pauseIndicator) pauseIndicator.setAttribute('title', tr('resumeRotation'));
		if (arrowLeft) arrowLeft.setAttribute('title', tr('prev'));
		if (arrowRight) arrowRight.setAttribute('title', tr('next'));
			const siteUrl = document.getElementById('site-url');
			if (siteUrl) siteUrl.setAttribute('placeholder', 'https://example.com');
		const newPl = document.getElementById('new-playlist-name');
		if (newPl) newPl.setAttribute('placeholder', tr('newPlaylistPlaceholder'));
			const siteUrlLabel = document.querySelector('label[for="site-url"]');
			if (siteUrlLabel) siteUrlLabel.textContent = tr('addUrl');
		const addBtnEl = document.getElementById('add-site');
		if (addBtnEl) addBtnEl.textContent = tr('add');
		const hintEl = document.querySelector('.hint');
		if (hintEl) hintEl.textContent = tr('tipIframe');
		const allH3 = document.querySelectorAll('.modal-section h3');
		if (allH3[1]) allH3[1].textContent = tr('listOfSites');
		const shuffleBtn = document.getElementById('shuffle-now');
		if (shuffleBtn) shuffleBtn.textContent = tr('nowSwitch');
		const clearBtnEl = document.getElementById('clear-all');
		if (clearBtnEl) clearBtnEl.textContent = tr('clearAll');
		if (reloadButton) {
			reloadButton.setAttribute('aria-label', tr('reload'));
			reloadButton.setAttribute('title', tr('reload'));
		}
		if (urlIndicator) {
			urlIndicator.setAttribute('aria-label', tr('currentUrl'));
		}
		const themeLbl = document.querySelector('label[for="theme-select"]');
		if (themeLbl) themeLbl.textContent = tr('themeLabel');
		const themeSelectEl = document.getElementById('theme-select');
		if (themeSelectEl) {
			const optSystem = themeSelectEl.querySelector('option[value="system"]');
			const optLight = themeSelectEl.querySelector('option[value="light"]');
			const optDark = themeSelectEl.querySelector('option[value="dark"]');
			if (optSystem) optSystem.textContent = tr('themeSystem');
			if (optLight) optLight.textContent = tr('themeLight');
			if (optDark) optDark.textContent = tr('themeDark');
		}
		const applyThemeBtnEl = document.getElementById('apply-theme');
		if (applyThemeBtnEl) applyThemeBtnEl.textContent = tr('apply');
	} catch {
		// ignore translation errors to avoid breaking the app
	}
}
// ---- Theme handling ----
function getStoredTheme() {
	const v = localStorage.getItem('dashboardRevolver.theme');
	return (v === 'system' || v === 'light' || v === 'dark') ? v : 'system';
}
function setStoredTheme(v) {
	const val = (v === 'light' || v === 'dark') ? v : 'system';
	localStorage.setItem('dashboardRevolver.theme', val);
	theme = val;
}
function applyTheme() {
	const root = document.documentElement;
	const body = document.body;
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
	if (effective === 'light') {
		root.setAttribute('data-theme', 'light');
		if (body) body.setAttribute('data-theme', 'light');
	} else {
		root.removeAttribute('data-theme');
		if (body) body.removeAttribute('data-theme');
	}
}
// follow system changes when in system mode
(function initThemeFollow() {
	if (!window.matchMedia) return;
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	const handler = () => {
		if (getStoredTheme() === 'system') {
			theme = 'system';
			applyTheme();
		}
	};
	try { mq.addEventListener('change', handler); } catch { mq.addListener?.(handler); }
})();
// ---- Client logger (batched) ----
const clientLogBuffer = [];
let clientLogFlushTimer = null;
function clientLog(level, message, meta = {}) {
	const entry = { ts: new Date().toISOString(), level, message, meta };
	clientLogBuffer.push(entry);
	if (clientLogBuffer.length > 1000) clientLogBuffer.shift();
	if (!clientLogFlushTimer) {
		clientLogFlushTimer = setTimeout(flushClientLogs, 1500);
	}
}
async function flushClientLogs() {
	try {
		const batch = clientLogBuffer.splice(0, clientLogBuffer.length);
		if (!batch.length) return;
		await fetch('/api/logs/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entries: batch })
		});
	} catch {
		// ignore
	} finally {
		clientLogFlushTimer = null;
		if (clientLogBuffer.length) clientLogFlushTimer = setTimeout(flushClientLogs, 1500);
	}
}
// Global error capture
window.addEventListener('error', (e) => {
	try { clientLog('error', 'window_error', { message: String(e.message), source: String(e.filename), lineno: e.lineno, colno: e.colno }); } catch {}
}, { passive: true });
window.addEventListener('unhandledrejection', (e) => {
	try { clientLog('error', 'unhandled_rejection', { reason: String(e.reason) }); } catch {}
});

function apiJson(url, options) {
	const init = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});
	return fetch(url, init).then((res) => {
		if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
		return res.json();
	});
}

async function loadPlaylists() {
	const data = await apiJson('/api/playlists');
	playlists = data.playlists || [];
	renderPlaylistOptions();
}

async function ensureDefaultPlaylist() {
	await loadPlaylists();
	if (playlists.length === 0) {
		const created = await apiJson('/api/playlists', {
			method: 'POST',
			body: JSON.stringify({ name: 'Standard', sites: DEFAULT_SITES, intervalMs })
		});
		playlists = [created.name];
	}
}

async function loadCurrentPlaylist() {
	let name = localStorage.getItem(STORAGE_KEYS.currentPlaylist);
	if (!name || !playlists.includes(name)) {
		name = playlists[0];
		localStorage.setItem(STORAGE_KEYS.currentPlaylist, name);
	}
	const pl = await apiJson(`/api/playlists/${encodeURIComponent(name)}`);
	currentPlaylist = pl;
	sites = Array.isArray(pl.sites) ? pl.sites.slice() : [];
	intervalMs = typeof pl.intervalMs === 'number' && pl.intervalMs >= 5000 ? pl.intervalMs : 30000;
	inactivityMs = typeof pl.inactivityMs === 'number' && pl.inactivityMs >= 5000 ? pl.inactivityMs : 15000;
	reloadPolicy = (pl.reloadPolicy === 'reload' || pl.reloadPolicy === 'cache') ? pl.reloadPolicy : 'cache';
	countdownEnabled = typeof pl.countdownEnabled === 'boolean' ? pl.countdownEnabled : true;
	intervalInput.value = Math.round(intervalMs / 1000);
	inactivityInput.value = Math.round(inactivityMs / 1000);
	reloadSelect.value = reloadPolicy;
	const countdownEnabledInput = document.getElementById('countdown-enabled');
	if (countdownEnabledInput) countdownEnabledInput.checked = !!countdownEnabled;
	if (!countdownEnabled) stopCountdown();
	renderPlaylistOptions(name);
	clientLog('info', 'playlist_loaded', { name, sites: sites.length, intervalMs, inactivityMs, reloadPolicy });
}

function renderPlaylistOptions(selected) {
	playlistSelect.innerHTML = '';
	playlists.forEach(n => {
		const opt = document.createElement('option');
		opt.value = n;
		opt.textContent = n;
		if (selected && selected === n) opt.selected = true;
		playlistSelect.appendChild(opt);
	});
}

function setIframeSrcSafe(url) {
	// Some sites block iframing (X-Frame-Options/CSP). If blocked, users will see a browser message.
	let finalUrl = url;
	if (reloadPolicy === 'reload') {
		try {
			const u = new URL(url);
			u.searchParams.set('_t', String(Date.now()));
			finalUrl = u.toString();
		} catch {
			// if invalid URL, fallback
			finalUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
		}
	}
	// Avoid unnecessary navigation in cache mode if URL identical
	if (reloadPolicy === 'cache') {
		if (typeof window.__lastIframeUrl === 'string' && window.__lastIframeUrl === finalUrl) {
			// keep as is
		} else {
			iframe.src = finalUrl;
			window.__lastIframeUrl = finalUrl;
		}
	} else {
		iframe.src = finalUrl;
		window.__lastIframeUrl = finalUrl;
	}
	// Update URL indicator
	try {
		const u = new URL(url);
		urlIndicator.textContent = `${u.hostname}${u.pathname}`;
		urlIndicator.setAttribute('title', url);
	} catch {
		urlIndicator.textContent = url;
		urlIndicator.setAttribute('title', url);
	}
	lastShownAt = Date.now();
	const dur = getCurrentDurationMs();
	nextSwitchAt = lastShownAt + dur;
	startCountdown();
	clientLog('info', 'show_site', { index: currentIndex, url });
}

// Try to inject a custom scrollbar into same-origin iframe documents
function tryInjectCustomScrollbar() {
	try {
		const doc = iframe.contentDocument;
		if (!doc) return;
		const root = doc.scrollingElement || doc.documentElement;
		if (!root) return;
		// Only inject if there is scrollable overflow
		const hasVerticalScroll = root.scrollHeight > root.clientHeight;
		const hasHorizontalScroll = root.scrollWidth > root.clientWidth;
		if (!hasVerticalScroll && !hasHorizontalScroll) return;
		const styleId = 'dashboard-revolver-custom-scrollbar';
		if (doc.getElementById(styleId)) return; // prevent duplicates
		const style = doc.createElement('style');
		style.id = styleId;
		style.textContent = `
			html, body { overflow-y: auto !important; overflow-x: auto !important; scrollbar-width: thin; scrollbar-color: #4cc2ff #0e141b; }
			/* Chromium/WebKit */
			*::-webkit-scrollbar { width: 10px; height: 10px; }
			*::-webkit-scrollbar-track { background: #0e141b; border-radius: 8px; }
			*::-webkit-scrollbar-thumb { background-color: #3aa7e0; border-radius: 8px; border: 2px solid #0e141b; }
			*::-webkit-scrollbar-thumb:hover { background-color: #4cc2ff; }
		`;
		doc.head ? doc.head.appendChild(style) : doc.documentElement.appendChild(style);
	} catch {
		// Cross-origin iframe; cannot access. Silently ignore.
	}
}
iframe.addEventListener('load', () => {
	// Best-effort: if same-origin, customize the scrollbar
	tryInjectCustomScrollbar();
});
function showCurrent() {
	if (!sites.length) return;
	if (currentIndex >= sites.length) currentIndex = 0;
	const entry = getSiteEntry(currentIndex);
	if (!entry || !entry.url) return;
	setIframeSrcSafe(entry.url);
}

function nextSite() {
	if (!sites.length) return;
	currentIndex = (currentIndex + 1) % sites.length;
	showCurrent();
	clientLog('info', 'next_site', { index: currentIndex });
}
function prevSite() {
	if (!sites.length) return;
	currentIndex = (currentIndex - 1 + sites.length) % sites.length;
	showCurrent();
	clientLog('info', 'prev_site', { index: currentIndex });
}

function startRotation() {
	if (isPaused) return;
	stopRotation();
	// schedule per-site
	const dur = getCurrentDurationMs();
	rotationTimer = setTimeout(() => {
		nextSite();
		startRotation();
	}, dur);
	clientLog('info', 'rotation_started', { intervalMs: dur });
}
function stopRotation() {
	if (rotationTimer) {
		clearTimeout(rotationTimer);
		rotationTimer = null;
	}
	stopCountdown();
	clientLog('info', 'rotation_stopped');
}

function setPaused(p) {
	isPaused = p;
	if (isPaused) {
		stopRotation();
		pauseIndicator.classList.add('visible');
		// start/reset inactivity auto-resume timer
		startAutoResumeTimer();
		stopCountdown();
		clientLog('info', 'paused');
	} else {
		pauseIndicator.classList.remove('visible');
		startRotation();
		stopAutoResumeTimer();
		nextSwitchAt = Date.now() + intervalMs;
		startCountdown();
		clientLog('info', 'resumed');
	}
}

function startAutoResumeTimer() {
	stopAutoResumeTimer();
	autoResumeTimer = setTimeout(() => {
		// auto-resume after inactivity window
		noPauseUntilTs = Date.now() + 1500; // buffer after resuming
		setPaused(false);
	}, inactivityMs);
}
function stopAutoResumeTimer() {
	if (autoResumeTimer) {
		clearTimeout(autoResumeTimer);
		autoResumeTimer = null;
	}
}

function startCountdown() {
	stopCountdown();
	if (!countdownEnabled) {
		countdownIndicator.classList.remove('visible');
		return;
	}
	updateCountdown(); // immediate
	countdownTimer = setInterval(updateCountdown, 250);
}
function stopCountdown() {
	if (countdownTimer) {
		clearInterval(countdownTimer);
		countdownTimer = null;
	}
	countdownIndicator.classList.remove('visible');
}
function updateCountdown() {
	if (!nextSwitchAt || isPaused) {
		countdownIndicator.classList.remove('visible');
		return;
	}
	if (!countdownEnabled) {
		countdownIndicator.classList.remove('visible');
		return;
	}
	const now = Date.now();
	const remaining = Math.max(0, nextSwitchAt - now);
	// Show only in the final segment (symbolic "5 seconds"): here we map the last 20% of interval to 5..1 steps
	const windowMs = Math.max(5000, Math.floor(getCurrentDurationMs() * 0.2));
	if (remaining <= windowMs) {
		const bucket = Math.max(1, Math.ceil((remaining / windowMs) * 5)); // 5..1
		countdownIndicator.textContent = String(bucket);
		countdownIndicator.classList.add('visible');
	} else {
		countdownIndicator.classList.remove('visible');
	}
}

function renderList() {
	siteList.innerHTML = '';
	sites.forEach((raw, i) => {
		const entry = typeof raw === 'string' ? { url: raw } : (raw || {});
		const url = String(entry.url || '');
		const li = document.createElement('li');
		li.className = 'site-item';

		const urlSpan = document.createElement('span');
		urlSpan.className = 'url';
		urlSpan.textContent = url;

		const durationInput = document.createElement('input');
		durationInput.type = 'number';
		durationInput.min = '5';
		durationInput.step = '5';
		durationInput.value = String(Math.round(((typeof entry.durationMs === 'number' ? entry.durationMs : intervalMs) / 1000)));
		durationInput.title = 'Ablaufzeit (Sekunden)';
		durationInput.style.width = '110px';

		const controls = document.createElement('div');
		controls.className = 'controls';

		const upBtn = document.createElement('button');
		upBtn.className = 'icon-btn';
		upBtn.title = 'Nach oben';
		upBtn.textContent = '▲';
		upBtn.onclick = () => {
			if (i > 0) {
				[sites[i - 1], sites[i]] = [sites[i], sites[i - 1]];
				saveSites();
				renderList();
			}
		};

		const downBtn = document.createElement('button');
		downBtn.className = 'icon-btn';
		downBtn.title = 'Nach unten';
		downBtn.textContent = '▼';
		downBtn.onclick = () => {
			if (i < sites.length - 1) {
				[sites[i + 1], sites[i]] = [sites[i], sites[i + 1]];
				saveSites();
				renderList();
			}
		};

		const removeBtn = document.createElement('button');
		removeBtn.className = 'icon-btn';
		removeBtn.title = 'Entfernen';
		removeBtn.textContent = '🗑';
		removeBtn.onclick = () => {
			sites.splice(i, 1);
			if (currentIndex >= sites.length) currentIndex = 0;
			savePlaylistDebounced();
			renderList();
			if (!sites.length) {
				iframe.removeAttribute('src');
				stopRotation();
			}
		};

		durationInput.addEventListener('change', () => {
			const secs = Math.max(5, Number(durationInput.value || '0'));
			durationInput.value = String(secs);
			const ms = secs * 1000;
			const updated = { url };
			if (ms !== intervalMs) updated.durationMs = ms;
			sites[i] = updated;
			savePlaylistDebounced();
			// If this is the current site, update scheduling
			if (i === currentIndex) {
				nextSwitchAt = Date.now() + ms;
				startRotation();
			}
		});

		controls.appendChild(durationInput);
		controls.appendChild(upBtn);
		controls.appendChild(downBtn);
		controls.appendChild(removeBtn);

		li.appendChild(urlSpan);
		li.appendChild(controls);
		siteList.appendChild(li);
	});
}

function addSiteFromInput() {
	const url = (urlInput.value || '').trim();
	if (!url) return;
	try {
		const u = new URL(url);
		if (!u.protocol.startsWith('http')) throw new Error('Invalid protocol');
	} catch {
		alert('Bitte eine gültige URL eingeben (z.B. https://example.com).');
		return;
	}
	sites.push({ url });
	urlInput.value = '';
	savePlaylistDebounced();
	renderList();
	if (sites.length === 1) {
		currentIndex = 0;
		showCurrent();
		startRotation();
	}
}

function applyInterval() {
	const secs = Math.max(5, Number(intervalInput.value || '0'));
	intervalInput.value = String(secs);
	intervalMs = secs * 1000;
	savePlaylistDebounced();
	startRotation();
}

function manualShuffle() {
	// If the last change was very recent (<1s), avoid flicker
	if (Date.now() - lastShownAt < 500) return;
	nextSite();
}

// Hidden modal trigger: mouse wiggle or tap anywhere
let showBtnTimeout = null;
function onAnyActivity() {
	settingsButton.classList.add('visible');
	reloadButton.classList.add('visible');
	urlIndicator.classList.add('visible');
	arrowLeft.classList.add('visible');
	arrowRight.classList.add('visible');
	// If currently not within the no-pause buffer, pause on activity
	const now = Date.now();
	if (now >= noPauseUntilTs) {
		setPaused(true);
	} else {
		// If in buffer and already paused/resumed state, just extend UI visibility
	}
	// If paused, activity should reset the auto-resume timer
	if (isPaused) startAutoResumeTimer();
	if (showBtnTimeout) clearTimeout(showBtnTimeout);
	showBtnTimeout = setTimeout(() => {
		settingsButton.classList.remove('visible');
		reloadButton.classList.remove('visible');
		urlIndicator.classList.remove('visible');
		arrowLeft.classList.remove('visible');
		arrowRight.classList.remove('visible');
	}, 2500);
}

function openModal() {
	modal.classList.add('open');
	modal.setAttribute('aria-hidden', 'false');
}
function closeModal() {
	modal.classList.remove('open');
	modal.setAttribute('aria-hidden', 'true');
}

async function savePlaylist() {
	if (!currentPlaylist) return;
	const body = {
		sites,
		intervalMs,
		inactivityMs,
		reloadPolicy,
		countdownEnabled
	};
	await apiJson(`/api/playlists/${encodeURIComponent(currentPlaylist.name)}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	});
}
const savePlaylistDebounced = debounce(() => { savePlaylist().catch(() => {}); }, 400);

function debounce(fn, wait) {
	let t = null;
	return (...args) => {
		if (t) clearTimeout(t);
		t = setTimeout(() => fn(...args), wait);
	};
}

// Wire events
if (applyLanguageBtn) {
	applyLanguageBtn.addEventListener('click', async () => {
		const val = languageSelect && languageSelect.value ? languageSelect.value : 'de';
		language = val;
		localStorage.setItem('dashboardRevolver.lang', language);
		await loadI18n(language);
		applyTranslations();
		flashApplied(applyLanguageBtn);
		clientLog('info', 'language_changed', { language });
	});
}
addBtn.addEventListener('click', addSiteFromInput);
urlInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') addSiteFromInput();
});
applyIntervalBtn.addEventListener('click', applyInterval);
applyInactivityBtn.addEventListener('click', () => {
	const secs = Math.max(5, Number(inactivityInput.value || '0'));
	inactivityInput.value = String(secs);
	inactivityMs = secs * 1000;
	savePlaylistDebounced();
	if (isPaused) {
		// restart inactivity timer with new value
		startAutoResumeTimer();
	}
	flashApplied(applyInactivityBtn);
});
applyReloadBtn.addEventListener('click', () => {
	const val = reloadSelect.value === 'reload' ? 'reload' : 'cache';
	reloadPolicy = val;
	savePlaylistDebounced();
	// apply on next switch; no immediate reload to avoid surprise
	flashApplied(applyReloadBtn);
});
shuffleNowBtn.addEventListener('click', manualShuffle);
clearAllBtn.addEventListener('click', () => {
	if (!confirm('Alle Websites löschen?')) return;
	sites = [];
	savePlaylistDebounced();
	renderList();
	iframe.removeAttribute('src');
	stopRotation();
		clientLog('info', 'sites_cleared');
});
closeBtn.addEventListener('click', closeModal);
settingsButton.addEventListener('click', () => {
	openModal();
	onAnyActivity();
		clientLog('info', 'open_settings');
});
reloadButton.addEventListener('click', () => {
	// Force reload by cache-busting current url
	const entry = getSiteEntry(currentIndex);
	if (!entry || !entry.url) return;
	try {
		const u = new URL(entry.url);
		u.searchParams.set('_r', String(Date.now()));
		iframe.src = u.toString();
	} catch {
		iframe.src = `${entry.url}${entry.url.includes('?') ? '&' : '?'}_r=${Date.now()}`;
	}
	onAnyActivity();
		clientLog('info', 'reload_click');
});
pauseIndicator.addEventListener('click', () => {
	// resume
	noPauseUntilTs = Date.now() + 1500; // buffer to prevent immediate re-pause on resulting events
	setPaused(false);
	onAnyActivity();
		clientLog('info', 'resume_click');
});
arrowLeft.addEventListener('click', () => {
	prevSite();
	onAnyActivity();
		clientLog('info', 'arrow_left');
});
arrowRight.addEventListener('click', () => {
	nextSite();
	onAnyActivity();
		clientLog('info', 'arrow_right');
});

['mousemove','pointerdown','touchstart','touchmove','wheel','keydown','pointermove'].forEach(evt => {
	window.addEventListener(evt, onAnyActivity, { passive: true });
});
// Try to detect pointer entering iframe area (works for mouse)
['mouseenter','mouseover','pointerenter'].forEach(evt => {
	iframe.addEventListener(evt, onAnyActivity, { passive: true });
});
// Top-edge gesture strip for touch
if (gestureEdge) {
	['pointerdown','pointermove','touchstart','touchmove'].forEach(evt => {
		gestureEdge.addEventListener(evt, onAnyActivity, { passive: true });
	});
}

// Countdown switch listener (immediate effect and persist)
(() => {
	const el = document.getElementById('countdown-enabled');
	if (!el) return;
	el.addEventListener('change', () => {
		countdownEnabled = !!el.checked;
		savePlaylistDebounced();
		if (!countdownEnabled) {
			stopCountdown();
		} else {
			startCountdown();
		}
	});
})();

// Theme select binding
if (applyThemeBtn && themeSelect) {
	applyThemeBtn.addEventListener('click', () => {
		const v = themeSelect.value;
		setStoredTheme(v);
		applyTheme();
		flashApplied(applyThemeBtn);
	});
}

// Tiny confirmation on apply buttons
function flashApplied(btn) {
	try {
		if (!btn) return;
		const oldText = btn.textContent;
		const oldBg = btn.style.background;
		const oldColor = btn.style.color;
		btn.disabled = true;
		btn.textContent = '✓';
		btn.style.background = '#22c55e'; /* green */
		btn.style.color = '#052e16';
		setTimeout(() => {
			btn.textContent = oldText;
			btn.style.background = oldBg;
			btn.style.color = oldColor;
			btn.disabled = false;
		}, 1200);
	} catch {}
}

// Initialize
(async function init() {
	try {
		// i18n boot
		if (languageSelect) languageSelect.value = language;
		await loadI18n(language);
		applyTranslations();
		// theme boot (system default)
		theme = getStoredTheme();
		if (themeSelect) themeSelect.value = theme;
		applyTheme();
		await ensureDefaultPlaylist();
		await loadCurrentPlaylist();
		renderList();
		if (sites.length) {
			showCurrent();
			startRotation();
		}
		onAnyActivity(); // show button initially for hint
	} catch (e) {
		console.error(e);
		alert('Fehler beim Laden der Playlists.');
		clientLog('error', 'init_failed', { error: String(e) });
	}
})();

// Logs modal wiring
openLogsBtn.addEventListener('click', async () => {
	await refreshLogs();
	logsModal.classList.add('open');
	logsModal.setAttribute('aria-hidden', 'false');
});
closeLogsBtn.addEventListener('click', () => {
	logsModal.classList.remove('open');
	logsModal.setAttribute('aria-hidden', 'true');
});
refreshLogsBtn.addEventListener('click', async () => {
	await refreshLogs();
});
if (downloadLogsBtn) {
	downloadLogsBtn.addEventListener('click', () => {
		try {
			const clientText = clientLogBuffer.map(e => `${e.ts} [${e.level}] ${e.message} ${JSON.stringify(e.meta || {})}`).join('\\n');
			const serverText = serverLogsPre.textContent || '';
			const all = `Client Logs\\n${clientText}\\n\\nServer Logs\\n${serverText}`;
			const blob = new Blob([all], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `dashboard-revolver-logs-${Date.now()}.txt`;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
		} catch {}
	});
}

async function refreshLogs() {
	// render client logs
	clientLogsPre.textContent = clientLogBuffer.map(e => `${e.ts} [${e.level}] ${e.message} ${JSON.stringify(e.meta || {})}`).join('\n');
	// fetch server logs
	try {
		const data = await apiJson('/api/logs');
		serverLogsPre.textContent = (data.server || []).map(e => `${e.ts} [${e.level}] ${e.message} ${JSON.stringify(e)}`).join('\n');
	} catch {
		serverLogsPre.textContent = 'Fehler beim Laden der Server-Logs.';
	}
}


