// Theme module: system/light/dark with persistence and media query follow
export function getStoredTheme() {
	const v = localStorage.getItem('dashboardRevolver.theme');
	return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function setStoredTheme(theme) {
	const v = theme === 'light' || theme === 'dark' ? theme : 'system';
	localStorage.setItem('dashboardRevolver.theme', v);
	applyTheme(v);
}

export function applyTheme(themeArg) {
	const theme = themeArg || getStoredTheme();
	const root = document.documentElement;
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
	if (effective === 'light') {
		root.setAttribute('data-theme', 'light');
	} else {
		root.removeAttribute('data-theme'); // default = dark
	}
}

export function initThemeFollow() {
	// re-apply on system theme change
	if (!window.matchMedia) return;
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	const handler = () => {
		if (getStoredTheme() === 'system') applyTheme('system');
	};
	try {
		mq.addEventListener('change', handler);
	} catch {
		// Safari
		mq.addListener?.(handler);
	}
	applyTheme(getStoredTheme());
}


