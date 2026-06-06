import type {
	AcceptStreamGuidelinesResponse,
	StreamGuidelinesResponse,
} from './accountTypes';
import type { WsClient } from './wsClient';
import { parseShareMetadata, type ShareMetadata, type ShareTargetType } from './shareTypes';

function assertShareTargetType(value: string): ShareTargetType {
	const v = value.trim();
	if (v !== 'post' && v !== 'live') throw new Error('type must be post or live');
	return v;
}

function assertTargetId(value: string): string {
	const id = value.trim();
	if (!id) throw new Error('target id is required');
	if (/\s/.test(id)) throw new Error('target id must not contain whitespace');
	return id;
}

function assertRequestIdTag(tag?: string): string | undefined {
	if (tag === undefined) return undefined;
	const t = tag.trim();
	if (!t) return undefined;
	if (/\s/.test(t)) throw new Error('requestId must not contain spaces');
	return t;
}

function assertOptionalChannel(channel?: string): string | undefined {
	if (channel === undefined) return undefined;
	const c = channel.trim();
	return c || undefined;
}

/** B11: `content /streamguidelines` */
export function contentWsStreamGuidelines(
	ws: WsClient,
	requestIdTag?: string
): Promise<StreamGuidelinesResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	return ws.request('content', 'streamguidelines', [], rid).then(json => json as StreamGuidelinesResponse);
}

/** B11: `content /acceptstreamguidelines` */
export function contentWsAcceptStreamGuidelines(
	ws: WsClient,
	requestIdTag?: string
): Promise<AcceptStreamGuidelinesResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	return ws.request('content', 'acceptstreamguidelines', [], rid).then(json => json as AcceptStreamGuidelinesResponse);
}

/** `> content <rid>\n/share <type> <id>` */
export function contentShare(
	ws: WsClient,
	type: ShareTargetType,
	targetId: string,
	requestId?: string
): Promise<ShareMetadata> {
	const t = assertShareTargetType(type);
	const id = assertTargetId(targetId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('content', 'share', [t, id], rid).then(json => {
		const meta = parseShareMetadata(json, t, id);
		if (!meta) throw new Error('Invalid content /share response');
		return meta;
	});
}

/** `> content <rid>\n/shareevent <type> <id> [channel=…]` */
export function contentShareEvent(
	ws: WsClient,
	type: ShareTargetType,
	targetId: string,
	channel?: string,
	requestId?: string
): Promise<{ ok: true }> {
	const t = assertShareTargetType(type);
	const id = assertTargetId(targetId);
	const ch = assertOptionalChannel(channel);
	const rid = assertRequestIdTag(requestId);
	const args = ch ? [t, id, `channel=${ch}`] : [t, id];
	return ws.request('content', 'shareevent', args, rid).then(json => {
		if (json && typeof json === 'object' && (json as Record<string, unknown>).ok === true) {
			return { ok: true as const };
		}
		return { ok: true as const };
	});
}
