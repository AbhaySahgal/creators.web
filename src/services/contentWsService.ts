import type {
	AcceptStreamGuidelinesResponse,
	StreamGuidelinesResponse,
} from './accountTypes';
import type { WsClient } from './wsClient';

function assertRequestIdTag(tag?: string): string | undefined {
	if (tag === undefined) return undefined;
	const t = tag.trim();
	if (!t) return undefined;
	if (/\s/.test(t)) throw new Error('requestId must not contain spaces');
	return t;
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
