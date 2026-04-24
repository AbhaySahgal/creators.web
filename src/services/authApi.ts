import type { User } from '../types';
import { postJson } from './http/client';

type SignupRole = 'fan' | 'creator';

interface ExchangeResponse {
	user: User;
	token: string;
}

function isValidUser(value: unknown): value is User {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return typeof candidate.id === 'string' &&
		typeof candidate.email === 'string' &&
		typeof candidate.role === 'string' &&
		typeof candidate.name === 'string';
}

export async function exchangeFirebaseToken(
	idToken: string,
	preferredRole?: SignupRole
): Promise<{ user: User, token: string } | null> {
	// If user provides an explicit exchange URL (separate service), prefer it.
	const urlOverride = import.meta.env.VITE_AUTH_EXCHANGE_URL?.trim();
	if (urlOverride) {
		return globalThis.fetch(urlOverride, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken, preferredRole }),
			credentials: 'include',
		}).then(response => {
			if (!response.ok) throw new Error('Unable to complete secure sign-in.');
			return response.json() as Promise<ExchangeResponse>;
		}).then(payload => {
			if (!isValidUser(payload.user) || typeof payload.token !== 'string') {
				throw new Error('Received invalid auth payload from server.');
			}
			return { user: payload.user, token: payload.token };
		});
	}

	return postJson<ExchangeResponse>('/auth/firebase/exchange', { idToken, preferredRole }).then(payload => {
		if (!isValidUser(payload.user) || typeof payload.token !== 'string') {
			throw new Error('Received invalid auth payload from server.');
		}
		return { user: payload.user, token: payload.token };
	}).catch(err => {
		// If Firebase exchange isn't configured server-side (501), let UI fall back gracefully.
		const message = err instanceof Error ? err.message : '';
		if (message.includes('501')) return null;
		throw err;
	});
}
