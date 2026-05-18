import { useCallback, useEffect, useRef, useState } from 'react';
import { useEnsureWsAuth, useWs, useWsAuthReady } from '../context/WsContext';
import { creatorsApi } from '../services/creatorsApi';
import { creatorContentStreams } from '../services/creatorWsService';
import type { ContentStreamItem, ContentStreamsResponse } from '../services/postsTypes';

/** Past streams shown per page in Content Manager. */
export const CONTENT_STREAMS_PAGE_SIZE = 5;

function asString(v: unknown, fallback = ''): string {
	if (typeof v === 'string') return v;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return fallback;
}

function normalizeStreamItem(raw: unknown): ContentStreamItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const id = asString(r.id || r.live_id).trim();
	if (!id) return null;
	const vis = r.visibility;
	const visibility =
		vis === 'followers' || vis === 'subscribers' || vis === 'everyone' ?
			vis :
			'everyone';
	const status = r.status === 'live' ? 'live' : 'ended';
	return {
		id,
		title: asString(r.title, 'Untitled stream'),
		status,
		visibility,
		banner_url: typeof r.banner_url === 'string' ? r.banner_url : null,
		viewer_count: Number(r.viewer_count) || 0,
		like_count: Number(r.like_count) || 0,
		tip_total_minor: asString(r.tip_total_minor, '0'),
		started_at: asString(r.started_at),
		ended_at: r.ended_at == null ? null : asString(r.ended_at),
	};
}

function normalizeStreamsResponse(raw: unknown): ContentStreamsResponse {
	const body = raw as Record<string, unknown>;
	const list = Array.isArray(body.streams) ? body.streams : [];
	const streams = list
		.map(normalizeStreamItem)
		.filter((s): s is ContentStreamItem => s != null);
	const nextCursor =
		typeof body.nextCursor === 'string' ? body.nextCursor :
		typeof body.next_cursor === 'string' ? body.next_cursor :
		null;
	return { streams, nextCursor };
}

function fetchStreamsPage(
	ws: ReturnType<typeof useWs>,
	ensureAuth: () => Promise<void>,
	wsReady: boolean,
	opts: { limit: number, before?: string }
): Promise<ContentStreamsResponse> {
	if (!wsReady) {
		return creatorsApi.content.streams({ limit: opts.limit, before: opts.before })
			.then(normalizeStreamsResponse);
	}
	return ensureAuth()
		.then(() => creatorContentStreams(ws, { limit: opts.limit, before: opts.before }))
		.then(normalizeStreamsResponse)
		.catch(() =>
			creatorsApi.content.streams({ limit: opts.limit, before: opts.before })
				.then(normalizeStreamsResponse)
		);
}

export function useContentStreams(enabled = true) {
	const ws = useWs();
	const ensureAuth = useEnsureWsAuth();
	const wsReady = useWsAuthReady();
	const [streams, setStreams] = useState<ContentStreamItem[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const initialLoadedRef = useRef(false);

	const fetchPage = useCallback((opts: { before?: string, append?: boolean }) => {
		const limit = CONTENT_STREAMS_PAGE_SIZE;
		return fetchStreamsPage(ws, ensureAuth, wsReady, { limit, before: opts.before })
			.then(body => {
				setStreams(prev => opts.append ? [...prev, ...body.streams] : body.streams);
				setNextCursor(body.nextCursor);
				setError(null);
				return body;
			});
	}, [ws, wsReady, ensureAuth]);

	const load = useCallback(() => {
		setLoading(true);
		return fetchPage({ append: false })
			.catch(e => {
				setError(e instanceof Error ? e.message : 'Could not load streams');
				throw e;
			})
			.finally(() => { setLoading(false); });
	}, [fetchPage]);

	const loadMore = useCallback(() => {
		if (!nextCursor || loadingMore) return Promise.resolve();
		setLoadingMore(true);
		return fetchPage({ before: nextCursor, append: true })
			.catch(e => {
				setError(e instanceof Error ? e.message : 'Could not load more');
				throw e;
			})
			.finally(() => { setLoadingMore(false); });
	}, [nextCursor, loadingMore, fetchPage]);

	useEffect(() => {
		if (!enabled || !wsReady) return;
		if (initialLoadedRef.current) return;
		initialLoadedRef.current = true;
		void load();
	}, [enabled, wsReady, load]);

	return {
		streams,
		nextCursor,
		loading,
		loadingMore,
		error,
		load,
		loadMore,
		hasMore: !!nextCursor,
	};
}
