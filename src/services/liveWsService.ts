import type { WsClient } from './wsClient';
import {
	normalizeLiveDto,
	normalizeLiveListLiveResponse,
	normalizeLiveStats,
	normalizeLiveTrendingResponse,
	normalizeLiveWithAgora,
} from './liveWsMap';
import type {
	LiveEndLiveResponse,
	LiveListFilter,
	LiveListLiveResponse,
	LiveStatsResponse,
	LiveTrendingResponse,
	LiveVisibility,
	LiveWithAgora,
} from './liveWsTypes';

const TITLE_MAX = 200;
const BANNER_URL_MAX = 2048;
const BANNER_ASSET_MAX = 128;

function clamp(s: string, max: number): string {
	return s.length <= max ? s : s.slice(0, max);
}

function assertVisibility(value: string): LiveVisibility {
	if (value !== 'everyone' && value !== 'followers' && value !== 'subscribers') {
		throw new Error('visibility must be everyone | followers | subscribers');
	}
	return value;
}

function assertListFilter(value: string): LiveListFilter {
	if (value === 'all' || value === 'everyone' || value === 'followers' || value === 'subscribers') {
		return value;
	}
	throw new Error('list filter must be all | everyone | followers | subscribers');
}

function assertLiveId(value: string): string {
	const v = String(value).trim();
	if (!v) throw new Error('liveId is required');
	if (/\s/.test(v)) throw new Error('liveId must not contain whitespace');
	return v;
}

function assertRequestIdTag(tag?: string): string | undefined {
	if (tag === undefined) return undefined;
	const t = tag.trim();
	if (!t) return undefined;
	if (/\s/.test(t)) throw new Error('requestId must not contain spaces');
	return t;
}

function buildTitle(raw: string): string {
	const t = raw.replace(/[\r\n]+/g, ' ').trim();
	if (!t) return '';
	return t.length <= TITLE_MAX ? t : t.slice(0, TITLE_MAX);
}

/** Strip leading `/` for `ws.request` (formatCommandLine adds it back). */
function commandBody(line: string): string {
	return line.startsWith('/') ? line.slice(1) : line;
}

export interface LiveGoLiveOpts {
	visibility: LiveVisibility;
	title: string;
	bannerUrl?: string;
	bannerAssetId?: string;
}

export interface LiveListLiveOpts {
	filter?: LiveListFilter;
	limit?: number;
	cursor?: string;
}

export interface LiveTrendingOpts {
	limit?: number;
	cursor?: string;
}

/**
 * B3/C3: `/golive <visibility> [banner_url=…] [banner_asset_id=…] [title]`
 * Visibility must be the first token — backend parses it positionally before KV opts.
 */
export function buildGoLiveCommand(opts: LiveGoLiveOpts): string {
	const vis = assertVisibility(opts.visibility);
	const title = buildTitle(opts.title);
	const bannerUrl = opts.bannerUrl?.trim() ?? '';
	const bannerAssetId = opts.bannerAssetId?.trim() ?? '';
	const parts: string[] = ['/golive', vis];
	if (bannerUrl) parts.push(`banner_url=${clamp(bannerUrl, BANNER_URL_MAX)}`);
	if (bannerAssetId) parts.push(`banner_asset_id=${clamp(bannerAssetId, BANNER_ASSET_MAX)}`);
	if (title) parts.push(title);
	return parts.join(' ');
}

/** B3: `/listlive [all|everyone|followers|subscribers] [limit=N] [cursor=…]` */
export function buildListLiveCommand(opts: LiveListLiveOpts = {}): string {
	const filter = opts.filter ? assertListFilter(opts.filter) : '';
	const limit = opts.limit != null ? Math.min(50, Math.max(1, opts.limit)) : undefined;
	const cursor = opts.cursor?.trim() ?? '';
	if (!filter && limit === undefined && !cursor) return '/listlive';
	const parts: string[] = ['/listlive'];
	if (filter) parts.push(filter);
	if (limit !== undefined) parts.push(`limit=${limit}`);
	if (cursor) parts.push(`cursor=${cursor}`);
	return parts.join(' ');
}

/** B2: `/trending [limit=N] [cursor=…]` */
export function buildTrendingCommand(opts: LiveTrendingOpts = {}): string {
	const limit = opts.limit != null ? Math.min(50, Math.max(1, opts.limit)) : undefined;
	const cursor = opts.cursor?.trim() ?? '';
	if (limit === undefined && !cursor) return '/trending';
	const parts: string[] = ['/trending'];
	if (limit !== undefined) parts.push(`limit=${limit}`);
	if (cursor) parts.push(`cursor=${cursor}`);
	return parts.join(' ');
}

export function liveGoLive(
	ws: WsClient,
	opts: LiveGoLiveOpts,
	requestId?: string
): Promise<LiveWithAgora> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', commandBody(buildGoLiveCommand(opts)), [], rid)
		.then(json => normalizeLiveWithAgora(json));
}

export function liveJoinLive(
	ws: WsClient,
	liveId: string,
	requestId?: string
): Promise<LiveWithAgora> {
	const id = assertLiveId(liveId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'joinlive', [id], rid).then(json => normalizeLiveWithAgora(json));
}

export function liveEndLive(ws: WsClient, requestId?: string): Promise<LiveEndLiveResponse> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'endlive', [], rid).then(json => {
		const root = json && typeof json === 'object' ? json as Record<string, unknown> : {};
		const live = normalizeLiveDto(root.live ?? root);
		if (!live) throw new Error('Invalid endlive response');
		return { ok: true as const, live };
	});
}

export function liveListLive(
	ws: WsClient,
	opts: LiveListLiveOpts = {},
	requestId?: string
): Promise<LiveListLiveResponse> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', commandBody(buildListLiveCommand(opts)), [], rid)
		.then(json => normalizeLiveListLiveResponse(json));
}

export function liveTrending(
	ws: WsClient,
	opts: LiveTrendingOpts = {},
	requestId?: string
): Promise<LiveTrendingResponse> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', commandBody(buildTrendingCommand(opts)), [], rid)
		.then(json => normalizeLiveTrendingResponse(json));
}

export function liveStats(
	ws: WsClient,
	liveId: string,
	requestId?: string
): Promise<LiveStatsResponse> {
	const rid = assertRequestIdTag(requestId);
	const id = assertLiveId(liveId);
	return ws.request('live', 'stats', [id], rid).then(json => {
		const root = json && typeof json === 'object' ? json as Record<string, unknown> : {};
		const stats = normalizeLiveStats(root.stats ?? root);
		if (!stats) throw new Error('Invalid live stats response');
		return { stats };
	});
}
