import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export type PostsFeed = 'feed' | 'explore' | 'creator';
export type PostVisibility = 'public' | 'subscribers' | 'ppv';

export interface PostDTO {
	id: string;
	user_id: string;
	text: string;
	visibility: PostVisibility;
	ppv_price_usd_cents: number | null;
	media: { type: 'image' | 'video', url: string }[];
	like_count: number;
	comment_count: number;
	created_at: string;
	updated_at: string;
}

export interface CommentDTO {
	id: string;
	post_id: string;
	user_id: string;
	text: string;
	created_at: string;
}

export function listPosts(feed: PostsFeed, limit?: number, beforeCursor?: string, creatorUserId?: string) {
	const reqId = makeRequestId('p');
	const args: string[] = ['/list', feed];
	if (feed === 'creator') {
		if (!creatorUserId) throw new Error('creatorUserId required for creator feed');
		args.push(creatorUserId);
	}
	if (limit) args.push(String(limit));
	if (beforeCursor) args.push(beforeCursor);
	return wsClient.request<{ posts: PostDTO[], nextCursor: string | null }>('posts', reqId, args.join(' '));
}

export function likePost(postId: string) {
	const reqId = makeRequestId('p');
	return wsClient.request<{ postId: string, like_count: number, likedByMe: true }>('posts', reqId, `/like ${postId}`);
}

export function unlikePost(postId: string) {
	const reqId = makeRequestId('p');
	return wsClient.request<{ postId: string, like_count: number, likedByMe: false }>('posts', reqId, `/unlike ${postId}`);
}

export function comment(postId: string, text: string) {
	const reqId = makeRequestId('p');
	return wsClient.request<{ comment: CommentDTO }>('posts', reqId, `/comment ${postId} ${text}`);
}

export function getComments(postId: string, limit?: number, beforeCursor?: string) {
	const reqId = makeRequestId('p');
	const args = ['/comments', postId];
	if (limit) args.push(String(limit));
	if (beforeCursor) args.push(beforeCursor);
	return wsClient.request<{ comments: CommentDTO[], nextCursor: string | null }>('posts', reqId, args.join(' '));
}

export function createPost(
	visibility: PostVisibility,
	text: string,
	ppvPriceUsdCents?: number,
	assetIds?: string[]
) {
	const reqId = makeRequestId('p');
	const args: string[] = ['/create', visibility];
	if (visibility === 'ppv') {
		args.push(String(ppvPriceUsdCents ?? 0));
	}
	if (assetIds?.length) {
		args.push(`assets=${assetIds.join(',')}`);
	}
	args.push(text);
	return wsClient.request<{ post: PostDTO }>('posts', reqId, args.join(' '));
}

export function updatePost(postId: string, text: string) {
	const reqId = makeRequestId('p');
	return wsClient.request<{ post: PostDTO }>('posts', reqId, `/update ${postId} ${text}`);
}

export function deletePost(postId: string) {
	const reqId = makeRequestId('p');
	return wsClient.request<{ ok: true }>('posts', reqId, `/delete ${postId}`);
}
