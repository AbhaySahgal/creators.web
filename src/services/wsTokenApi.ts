const WS_TOKEN_URL = import.meta.env.VITE_WS_TOKEN_URL as string | undefined;

export interface WsTokenResponse {
	token: string;
}

export async function fetchWsToken(): Promise<string> {
	if (!WS_TOKEN_URL) {
		throw new Error('VITE_WS_TOKEN_URL is not configured');
	}

	const resp = await globalThis.fetch(WS_TOKEN_URL, {
		method: 'GET',
		credentials: 'include',
	});

	if (!resp.ok) {
		throw new Error('Unable to fetch WebSocket token');
	}

	const data = await resp.json() as WsTokenResponse;
	if (!data || typeof data.token !== 'string' || data.token.length < 10) {
		throw new Error('Invalid WebSocket token response');
	}

	return data.token;
}

