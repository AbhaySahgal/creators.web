import { apiErrorMessage, creatorsApi } from './creatorsApi';
import { contentShare, contentShareEvent } from './contentWsService';
import { normalizeShareEventRequest, type ShareMetadata, type ShareTargetType } from './shareTypes';
import type { WsClient } from './wsClient';

export function fetchShareMetadata(
	type: ShareTargetType,
	targetId: string,
	opts?: { ws?: WsClient | null, wsAuthReady?: boolean }
): Promise<ShareMetadata> {
	const id = targetId.trim();
	const ws = opts?.ws;
	if (ws?.isConnected && opts?.wsAuthReady) {
		return contentShare(ws, type, id).catch(() => creatorsApi.share.get(type, id));
	}
	return creatorsApi.share.get(type, id);
}

export function recordShareEvent(
	type: ShareTargetType,
	targetId: string,
	channel: string | undefined,
	opts?: { ws?: WsClient | null, wsAuthReady?: boolean }
): Promise<void> {
	const body = normalizeShareEventRequest({ targetType: type, targetId, channel });
	const ws = opts?.ws;
	const wsPromise =
		ws?.isConnected && opts?.wsAuthReady ?
			contentShareEvent(ws, body.targetType, body.targetId, body.channel).catch(() => undefined) :
			Promise.resolve();
	return wsPromise.then(() =>
		creatorsApi.share.recordEvent(body).then(() => undefined).catch(() => undefined)
	);
}

/** Web Share API using only B5 metadata fields (no url — not in GET response). */
export function nativeShare(metadata: ShareMetadata): Promise<boolean> {
	if (typeof navigator.share !== 'function') return Promise.resolve(false);
	const payload: ShareData = {};
	if (metadata.title) payload.title = metadata.title;
	if (metadata.description) payload.text = metadata.description;
	if (!payload.title && !payload.text) return Promise.resolve(false);
	return navigator.share(payload).then(() => true).catch(err => {
		if (err instanceof DOMException && err.name === 'AbortError') return false;
		throw err;
	});
}

export function shareErrorMessage(err: unknown, fallback: string): string {
	return apiErrorMessage(err, fallback);
}
