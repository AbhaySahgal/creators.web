import type { WsClient } from './wsClient';
import type {
	LiveAnalyticsResponse,
	LiveEndLiveResponse,
	LiveListLiveResponse,
	LiveMyAnalyticsResponse,
	LiveStats,
	LiveVisibility,
	LiveWithAgora,
} from './liveWsTypes';

const TITLE_MAX = 200;

function assertVisibility(value: string): LiveVisibility {
	if (value !== 'everyone' && value !== 'followers' && value !== 'subscribers') {
		throw new Error('visibility must be everyone | followers | subscribers');
	}
	return value;
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
	// Title is everything after `<visibility>` on the spec line; backend joins with spaces.
	// We trim and clamp to a sane upper bound so a stray newline doesn't break framing.
	const t = raw.replace(/[\r\n]+/g, ' ').trim();
	if (!t) return '';
	return t.length <= TITLE_MAX ? t : t.slice(0, TITLE_MAX);
}

/** `> live <rid>\n/golive <visibility> <title>` => LiveWithAgora */
export function liveGoLive(
	ws: WsClient,
	opts: { visibility: LiveVisibility, title: string },
	requestId?: string
): Promise<LiveWithAgora> {
	const vis = assertVisibility(opts.visibility);
	const title = buildTitle(opts.title);
	const rid = assertRequestIdTag(requestId);
	const args = title ? [vis, title] : [vis];
	return ws.request('live', 'golive', args, rid).then(json => json as LiveWithAgora);
}

/** `> live <rid>\n/joinlive <liveId>` => LiveWithAgora */
export function liveJoinLive(
	ws: WsClient,
	liveId: string,
	requestId?: string
): Promise<LiveWithAgora> {
	const id = assertLiveId(liveId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'joinlive', [id], rid).then(json => json as LiveWithAgora);
}

/** `> live <rid>\n/endlive` => LiveEndLiveResponse */
export function liveEndLive(ws: WsClient, requestId?: string): Promise<LiveEndLiveResponse> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'endlive', [], rid).then(json => json as LiveEndLiveResponse);
}

/** `> live <rid>\n/listlive` => LiveListLiveResponse */
export function liveListLive(ws: WsClient, requestId?: string): Promise<LiveListLiveResponse> {
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'listlive', [], rid).then(json => json as LiveListLiveResponse);
}

/** C5: `live /stats <liveId>` => LiveStats */
export function liveStats(ws: WsClient, liveId: string, requestId?: string): Promise<LiveStats> {
	const id = assertLiveId(liveId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'stats', [id], rid).then(json => json as LiveStats);
}

/** C4: `live /analytics <liveId>` */
export function liveAnalytics(ws: WsClient, liveId: string, requestId?: string): Promise<LiveAnalyticsResponse> {
	const id = assertLiveId(liveId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'analytics', [id], rid).then(json => json as LiveAnalyticsResponse);
}

/** C4: `live /myanalytics [from=…] [to=…]` */
export function liveMyAnalytics(
	ws: WsClient,
	opts?: { from?: string, to?: string },
	requestId?: string
): Promise<LiveMyAnalyticsResponse> {
	const args: string[] = [];
	if (opts?.from) args.push(`from=${opts.from.trim()}`);
	if (opts?.to) args.push(`to=${opts.to.trim()}`);
	const rid = assertRequestIdTag(requestId);
	return ws.request('live', 'myanalytics', args, rid).then(json => json as LiveMyAnalyticsResponse);
}
