import type { WsClient } from './wsClient';
import type { CreatePostResponse, PostInsightsResponse } from './postsTypes';

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

export function postsCreate(ws: WsClient, input: CreatePostInput, requestId?: string): Promise<CreatePostResponse> {
	const { command, args } = parseCommandLine(buildCreatePostCommand(input));
	return ws.request('posts', command, args, requestId).then(json => json as CreatePostResponse);
}

export function postsInsights(ws: WsClient, postId: string, requestId?: string): Promise<PostInsightsResponse> {
	const id = String(postId).trim();
	if (!id) throw new Error('postId is required');
	if (/\s/.test(id)) throw new Error('postId must not contain whitespace');
	return ws.request('posts', 'insights', [id], requestId).then(json => json as PostInsightsResponse);
}
