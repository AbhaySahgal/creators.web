const TOKEN_STORAGE_KEY = 'creators.accessToken';

export function getAccessToken(): string | null {
	try {
		const token = globalThis.localStorage?.getItem(TOKEN_STORAGE_KEY);
		return token?.trim() ? token : null;
	} catch {
		return null;
	}
}

export function setAccessToken(token: string): void {
	try {
		globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
	} catch {
		// ignore storage failures (private mode, policies, etc.)
	}
}

export function clearAccessToken(): void {
	try {
		globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
	} catch {
		// ignore
	}
}
