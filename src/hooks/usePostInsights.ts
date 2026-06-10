import { useCallback, useState } from 'react';
import { useEnsureWsAuth, useWs, useWsAuthReady } from '../context/WsContext';
import { creatorsApi } from '../services/creatorsApi';
import { postsInsights } from '../services/postsWsService';
import type { PostInsightsResponse, PostInsightsTimeSeriesPoint } from '../services/postsTypes';

type CacheEntry = {
	data: PostInsightsResponse,
	at: number,
};

const cache: Record<string, CacheEntry> = {};
const inflight: Record<string, Promise<PostInsightsResponse>> = {};

function asString(v: unknown, fallback = ''): string {
	if (typeof v === 'string') return v;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return fallback;
}

function recordOrEmpty(v: unknown): Record<string, unknown> {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
	return Object.fromEntries(Object.entries(v));
}

function normalizeInsights(raw: unknown): PostInsightsResponse {
	const body = raw as Record<string, unknown>;
	const root =
		body && typeof body === 'object' && 'insights' in body ?
			(body.insights as Record<string, unknown>) :
			body;
	const r = recordOrEmpty(root);
	const rawSeries = Array.isArray(r.time_series) ? r.time_series : [];
	const time_series = rawSeries.filter(
		(pt): pt is PostInsightsTimeSeriesPoint => typeof pt === 'object' && pt != null
	);
	return {
		like_count: Number(r.like_count) || 0,
		comment_count: Number(r.comment_count) || 0,
		tip_count: Number(r.tip_count) || 0,
		tips_cents: asString(r.tips_cents, '0'),
		ppv_unlock_count: Number(r.ppv_unlock_count) || 0,
		time_series,
	};
}

function fetchInsightsWsThenHttp(
	ws: ReturnType<typeof useWs>,
	ensureAuth: () => Promise<void>,
	wsReady: boolean,
	postId: string
): Promise<PostInsightsResponse> {
	if (!wsReady) {
		return creatorsApi.posts.insights(postId).then(normalizeInsights);
	}
	return ensureAuth()
		.then(() => postsInsights(ws, postId))
		.then(normalizeInsights)
		.catch(() => creatorsApi.posts.insights(postId).then(normalizeInsights));
}

export function usePostInsights(postId: string) {
	const ws = useWs();
	const ensureAuth = useEnsureWsAuth();
	const wsReady = useWsAuthReady();
	const [data, setData] = useState<PostInsightsResponse | null>(() => cache[postId]?.data ?? null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback((opts?: { force?: boolean }) => {
		const id = postId.trim();
		if (!id) return Promise.resolve();

		if (!opts?.force) {
			const hit = cache[id];
			if (hit) {
				setData(hit.data);
				setError(null);
				return Promise.resolve();
			}
			const pending = inflight[id];
			if (pending !== undefined) {
				setLoading(true);
				return pending
					.then(d => {
						setData(d);
						setError(null);
					})
					.catch(e => {
						setError(e instanceof Error ? e.message : 'Could not load insights');
					})
					.finally(() => {
						setLoading(false);
					});
			}
		}

		setLoading(true);
		setError(null);

		const p = fetchInsightsWsThenHttp(ws, ensureAuth, wsReady, id)
			.then(d => {
				cache[id] = { data: d, at: Date.now() };
				setData(d);
				setError(null);
				return d;
			})
			.finally(() => {
				delete inflight[id];
				setLoading(false);
			});

		inflight[id] = p;
		return p.catch(e => {
			setError(e instanceof Error ? e.message : 'Could not load insights');
			throw e;
		});
	}, [postId, ws, wsReady, ensureAuth]);

	return { data, loading, error, load };
}
