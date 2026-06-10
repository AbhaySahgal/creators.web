import type { WsClient } from './wsClient';
import {
	parseGetPostResponse,
	parseUnlockPostResponse,
	type CreatePostResponse,
	type GetPostResponse,
	type PostInsightsResponse,
	type UnlockPostResponse,
} from './postsTypes';

export interface CreatePostInput {
	visibility: 'public' | 'subscribers' | 'ppv';
	text: string;
	assetIds?: string[];
	ppvUsdCents?: number;
}

/** Build `> posts …\n/create …` command line (without service prefix). */
export function buildCreatePostCommand(input: CreatePostInput): string {
	const parts: string[] = ['/create', input.visibility];
	if (input.visibility === 'ppv' && input.ppvUsdCents != null) {
		parts.push(String(input.ppvUsdCents));
	}
	if (input.assetIds?.length) {
		parts.push(`assets=${input.assetIds.join(',')}`);
	}
	let t = input.text.trim();
	if (
		t &&
		input.visibility !== 'ppv' &&
		!input.assetIds?.length &&
		/^\d/.test(t)
	) {
		t = `\u200B${t}`;
	}
	if (t) parts.push(t);
	return parts.join(' ');
}

function parseCommandLine(line: string): { command: string, args: string[] } {
	const trimmed = line.trim();
	if (!trimmed.startsWith('/')) {
		throw new Error(`Invalid WS command line: ${trimmed}`);
	}
	const parts = trimmed.split(' ');
	return { command: parts[0].slice(1), args: parts.slice(1) };
}

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

export function postsCreate(ws: WsClient, input: CreatePostInput, requestId?: string): Promise<CreatePostResponse> {
	const { command, args } = parseCommandLine(buildCreatePostCommand(input));
	return ws.request('posts', command, args, requestId).then(json => json as CreatePostResponse);
}

export function postsInsights(ws: WsClient, postId: string, requestId?: string): Promise<PostInsightsResponse> {
	const id = assertPostId(postId);
	const rid = assertRequestIdTag(requestId);
	return ws.request('posts', 'insights', [id], rid).then(json => json as PostInsightsResponse);
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
