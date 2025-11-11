let I18N = null;
const I18N_CACHE = {};

export function getLanguage() {
	return localStorage.getItem('dashboardRevolver.lang') || 'de';
}
export function setLanguage(lang) {
	localStorage.setItem('dashboardRevolver.lang', lang);
}

export async function loadI18n(lang) {
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
export function tr(k) { return (I18N && I18N[k]) || k; }

export function applyTranslations() {
	try {
		const h2 = document.querySelector('h2');
		if (h2) h2.textContent = tr('settings');
		const firstH3 = document.querySelector('.modal-section h3');
		if (firstH3) firstH3.textContent = tr('playlist');
		const lblInterval = document.querySelector('label[for=\"interval-seconds\"]');
		if (lblInterval) lblInterval.textContent = tr('rotationSeconds');
		const lblInactivity = document.querySelector('label[for=\"inactivity-seconds\"]');
		if (lblInactivity) lblInactivity.textContent = tr('inactivitySeconds');
		const lblReload = document.querySelector('label[for=\"reload-policy\"]');
		if (lblReload) lblReload.textContent = tr('reloadPolicy');
		const optCache = document.querySelector('#reload-policy option[value=\"cache\"]');
		if (optCache) optCache.textContent = tr('reloadCache');
		const optReload = document.querySelector('#reload-policy option[value=\"reload\"]');
		if (optReload) optReload.textContent = tr('reloadAlways');
		const lblLang = document.querySelector('label[for=\"language-select\"]');
		if (lblLang) lblLang.textContent = tr('languageLabel');
		const lblCountdown = document.querySelector('label[for=\"countdown-enabled\"]');
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
		const settingsButton = document.getElementById('settings-button');
		const pauseIndicator = document.getElementById('pause-indicator');
		const arrowLeft = document.getElementById('arrow-left');
		const arrowRight = document.getElementById('arrow-right');
		if (settingsButton) settingsButton.setAttribute('title', tr('openSettings'));
		if (pauseIndicator) pauseIndicator.setAttribute('title', tr('resumeRotation'));
		if (arrowLeft) arrowLeft.setAttribute('title', tr('prev'));
		if (arrowRight) arrowRight.setAttribute('title', tr('next'));
		const siteUrl = document.getElementById('site-url');
		if (siteUrl) siteUrl.setAttribute('placeholder', 'https://example.com');
		const newPl = document.getElementById('new-playlist-name');
		if (newPl) newPl.setAttribute('placeholder', tr('newPlaylistPlaceholder'));
		const siteUrlLabel = document.querySelector('label[for=\"site-url\"]');
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
		const reloadButton = document.getElementById('reload-button');
		const urlIndicator = document.getElementById('url-indicator');
		if (reloadButton) {
			reloadButton.setAttribute('aria-label', tr('reload'));
			reloadButton.setAttribute('title', tr('reload'));
		}
		if (urlIndicator) {
			urlIndicator.setAttribute('aria-label', tr('currentUrl'));
		}
		const themeLbl = document.querySelector('label[for=\"theme-select\"]');
		if (themeLbl) themeLbl.textContent = tr('themeLabel');
		const themeSelect = document.getElementById('theme-select');
		if (themeSelect) {
			const optSystem = themeSelect.querySelector('option[value=\"system\"]');
			const optLight = themeSelect.querySelector('option[value=\"light\"]');
			const optDark = themeSelect.querySelector('option[value=\"dark\"]');
			if (optSystem) optSystem.textContent = tr('themeSystem');
			if (optLight) optLight.textContent = tr('themeLight');
			if (optDark) optDark.textContent = tr('themeDark');
		}
	} catch {}
}


