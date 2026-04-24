function stripTrailingSlash(url: string): string {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getApiBaseUrl(): string {
	const raw = import.meta.env.VITE_CREATORS_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://creatorsapi.pnine.me';
	return stripTrailingSlash(raw);
}

export function getWsBaseUrl(): string {
	return import.meta.env.VITE_CREATORS_WS_URL || import.meta.env.VITE_WS_URL || 'wss://creatorsapi.pnine.me/ws';
}
