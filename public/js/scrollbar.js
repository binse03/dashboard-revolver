export function tryInjectCustomScrollbar(iframe) {
	try {
		const doc = iframe?.contentDocument;
		if (!doc) return;
		const root = doc.scrollingElement || doc.documentElement;
		if (!root) return;
		const hasVerticalScroll = root.scrollHeight > root.clientHeight;
		const hasHorizontalScroll = root.scrollWidth > root.clientWidth;
		if (!hasVerticalScroll && !hasHorizontalScroll) return;
		const styleId = 'dashboard-revolver-custom-scrollbar';
		if (doc.getElementById(styleId)) return;
		const style = doc.createElement('style');
		style.id = styleId;
		style.textContent = `
			html, body { overflow-y: auto !important; overflow-x: auto !important; scrollbar-width: thin; scrollbar-color: #4cc2ff #0e141b; }
			*::-webkit-scrollbar { width: 10px; height: 10px; }
			*::-webkit-scrollbar-track { background: #0e141b; border-radius: 8px; }
			*::-webkit-scrollbar-thumb { background-color: #3aa7e0; border-radius: 8px; border: 2px solid #0e141b; }
			*::-webkit-scrollbar-thumb:hover { background-color: #4cc2ff; }
		`;
		doc.head ? doc.head.appendChild(style) : doc.documentElement.appendChild(style);
	} catch {
		// Cross-origin: ignore
	}
}


