import { useCallback } from 'react';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';
import type { StreamGuidelinesResponse } from '../services/accountTypes';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import { contentWsAcceptStreamGuidelines, contentWsStreamGuidelines } from '../services/contentWsService';

export function isGuidelinesGateError(message: string): boolean {
	const m = message.toLowerCase();
	return m.includes('guideline') ||
		m.includes('agreement') ||
		m.includes('not accepted') ||
		m.includes('must accept');
}

let guidelinesCache: StreamGuidelinesResponse | null = null;
let guidelinesInflight: Promise<StreamGuidelinesResponse> | null = null;

export function clearStreamGuidelinesCache(): void {
	guidelinesCache = null;
	guidelinesInflight = null;
}

export function useStreamGuidelines() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureAuth = useEnsureWsAuth();
	const canUseWs = wsConnected && wsAuthReady;

	const fetchGuidelines = useCallback((): Promise<StreamGuidelinesResponse> => {
		if (guidelinesCache) return Promise.resolve(guidelinesCache);
		if (guidelinesInflight) return guidelinesInflight;

		const run = (): Promise<StreamGuidelinesResponse> => {
			if (canUseWs) {
				return ensureAuth().then(() => contentWsStreamGuidelines(ws));
			}
			return creatorsApi.content.streamGuidelines();
		};

		guidelinesInflight = run()
			.then(res => {
				guidelinesCache = res;
				guidelinesInflight = null;
				return res;
			})
			.catch(err => {
				guidelinesInflight = null;
				throw err;
			});

		return guidelinesInflight;
	}, [canUseWs, ensureAuth, ws]);

	const acceptGuidelines = useCallback((): Promise<{ ok: true }> => {
		const httpAccept = creatorsApi.me.acceptStreamGuidelines();
		const done = canUseWs ?
			ensureAuth()
				.then(() => Promise.all([
					contentWsAcceptStreamGuidelines(ws),
					httpAccept,
				]))
				.then(() => ({ ok: true as const })) :
			httpAccept;

		return done.then(res => {
			clearStreamGuidelinesCache();
			return res;
		});
	}, [canUseWs, ensureAuth, ws]);

	const formatError = useCallback(
		(e: unknown, fallback: string) => apiErrorMessage(e, fallback),
		[]
	);

	return {
		fetchGuidelines,
		acceptGuidelines,
		formatError,
	};
}
