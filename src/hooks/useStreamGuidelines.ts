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

export function useStreamGuidelines() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureAuth = useEnsureWsAuth();
	const canUseWs = wsConnected && wsAuthReady;

	const fetchGuidelines = useCallback((): Promise<StreamGuidelinesResponse> => {
		if (canUseWs) {
			return ensureAuth().then(() => contentWsStreamGuidelines(ws));
		}
		return creatorsApi.content.streamGuidelines();
	}, [canUseWs, ensureAuth, ws]);

	const acceptGuidelines = useCallback((): Promise<{ ok: true }> => {
		const httpAccept = creatorsApi.me.acceptStreamGuidelines();
		if (canUseWs) {
			return ensureAuth()
				.then(() => Promise.all([
					contentWsAcceptStreamGuidelines(ws),
					httpAccept,
				]))
				.then(() => ({ ok: true as const }));
		}
		return httpAccept;
	}, [canUseWs, ensureAuth, ws]);

	return {
		fetchGuidelines,
		acceptGuidelines,
		formatError: (e: unknown, fallback: string) => apiErrorMessage(e, fallback),
	};
}
