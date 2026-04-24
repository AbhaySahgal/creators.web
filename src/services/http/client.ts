import { getApiBaseUrl } from './env';
import { getAccessToken } from '../auth/tokenStore';
import { HttpError } from './errors';

export interface RequestOptions {
	auth?: boolean;
	signal?: AbortSignal;
	headers?: Record<string, string>;
}

function readBodySafe(response: Response): Promise<unknown> {
	return response.text().catch(() => '').then(text => {
		if (!text) return null;
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return text;
		}
	});
}

function requestJson<T>(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
	const headers: Record<string, string> = {
		Accept: 'application/json',
		...options?.headers,
	};

	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}

	if (options?.auth) {
		const token = getAccessToken();
		if (token) headers.Authorization = `Bearer ${token}`;
	}

	return globalThis.fetch(url, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		credentials: 'include',
		signal: options?.signal,
	}).then(resp => {
		if (!resp.ok) {
			return readBodySafe(resp).then(parsed => {
				const message =
					typeof parsed === 'object' && parsed && 'message' in (parsed as Record<string, unknown>) ?
						String((parsed as Record<string, unknown>).message) :
						`Request failed (${resp.status})`;
				throw new HttpError(message, resp.status, parsed);
			});
		}

		if (resp.status === 204) return null as T;

		return resp.json() as Promise<T>;
	});
}

export function getJson<T>(path: string, options?: RequestOptions): Promise<T> {
	return requestJson<T>('GET', path, undefined, options);
}

export function postJson<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
	return requestJson<T>('POST', path, body, options);
}
