// Lightweight API helper localized to this module to avoid circular deps
async function postJson(url, body) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body || {})
	});
	if (!res.ok) {
		const err = new Error(`${res.status} ${res.statusText}`);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

export async function createPlaylistOnServer(payload) {
	const { name } = payload || {};
	if (!name || typeof name !== 'string' || !name.trim()) {
		const err = new Error('400 Name required');
		err.status = 400;
		throw err;
	}
	return await postJson('/api/playlists', payload);
}

export function isDuplicateError(err) {
	return !!(err && (err.status === 409 || String(err.message || '').includes('409')));
}

export function normalizeName(name) {
	return String(name || '').trim();
}


