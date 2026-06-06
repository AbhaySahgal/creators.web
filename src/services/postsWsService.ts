import type { WsClient } from './wsClient';
import {
	parseGetPostResponse,
	parseUnlockPostResponse,
	type GetPostResponse,
	type UnlockPostResponse,
} from './postsTypes';

function assertPostId(value: string): string {
	const id = value.trim();
	if (!id) throw new Error('post id is required');
	if (/\s/.test(id)) throw new Error('post id must not contain whitespace');
	return id;
}

function assertRequestIdTag(tag?: string): string | undefined {
	if (tag === undefined) return undefined;
	const t = tag.trim();
	if (!t) return undefined;
	if (/\s/.test(t)) throw new Error('requestId must not contain spaces');
	return t;
}

/** `> posts <rid>\n/get <postId>` */
export function postsGet(
	ws: WsClient,
	postId: string,
	requestId?: string
): Promise<GetPostResponse> {
	const id = assertPostId(postId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('posts', 'get', [id], rid).then(json => {
		const res = parseGetPostResponse(json);
		if (!res) throw new Error('Invalid posts /get response');
		return res;
	});
}

/** `> posts <rid>\n/unlock <postId>` */
export function postsUnlock(
	ws: WsClient,
	postId: string,
	requestId?: string
): Promise<UnlockPostResponse> {
	const id = assertPostId(postId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('posts', 'unlock', [id], rid).then(json => {
		const res = parseUnlockPostResponse(json);
		if (!res) throw new Error('Invalid posts /unlock response');
		return res;
	});
}
