export type PostVisibility = 'public' | 'subscribers' | 'ppv';

export interface PostMediaDTO {
	type: 'image' | 'video';
	url: string;
	[key: string]: unknown;
}

export interface PostDTO {
	id: string;
	// Numeric id as string (per backend spec)
	user_id: string;
	text: string;
	visibility: PostVisibility;
	ppv_price_usd_cents: number | null;
	media: PostMediaDTO[];
	like_count: number;
	comment_count: number;
	created_at: string;
	updated_at: string;
}

export interface CommentDTO {
	id: string;
	post_id: string;
	// Numeric id as string (per backend spec)
	user_id: string;
	text: string;
	created_at: string;
	/** null = top-level comment */
	parent_comment_id?: string | null;
	heart_count?: number;
	/**
	 * Extended comment author (Fan features batch 1 / posts spec).
	 * When set, clients should prefer these over creator-directory lookup (fans are not in `creator /get`).
	 */
	display_name?: string | null;
	user_display_name?: string | null;
	user_name?: string | null;
	name?: string | null;
	username?: string | null;
	avatar_url?: string | null;
	user_avatar_url?: string | null;
	/** v4 CommentDTO author aliases */
	author_display_name?: string | null;
	author_avatar_url?: string | null;
}

export interface CommentHeartUpdatePayload {
	post_id: string;
	comment_id: string;
	heart_count: number;
}

/** v4 A3: `posts /heartcomment` response. */
export interface HeartCommentResponse {
	comment_id: string;
	post_id: string;
	heart_count: number;
	comment_author_user_id: string;
	newlyHearted: boolean;
}

function coerceBool(v: unknown): boolean {
	if (typeof v === 'boolean') return v;
	if (v === 1 || v === '1' || v === 'true') return true;
	return false;
}

function coerceId(v: unknown): string {
	if (typeof v === 'string') return v;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return '';
}

export function parseHeartCommentResponse(json: unknown): HeartCommentResponse | null {
	if (!json || typeof json !== 'object') return null;
	const row = json as Record<string, unknown>;
	const comment_id = coerceId(row.comment_id);
	const post_id = coerceId(row.post_id);
	if (!comment_id || !post_id) return null;
	const heart_count = Number(row.heart_count);
	return {
		comment_id,
		post_id,
		heart_count: Number.isFinite(heart_count) ? heart_count : 0,
		comment_author_user_id: coerceId(row.comment_author_user_id),
		newlyHearted: coerceBool(row.newlyHearted ?? row.newly_hearted),
	};
}

export interface ReportPostResponse {
	ok: true;
	already_reported?: true;
}

export interface ListPostsResponse {
	posts: PostDTO[];
	nextCursor: string | null;
}

export interface ListCommentsResponse {
	comments: CommentDTO[];
	nextCursor: string | null;
}

export interface CreatePostResponse {
	post: PostDTO;
}

export interface LikePostResponse {
	postId: string;
	like_count: number;
	likedByMe: boolean;
}

export interface CreateCommentResponse {
	comment: CommentDTO;
}

export interface DeletePostResponse {
	ok: true;
}

export type PostsPushEvent =
	| 'new' |
	'updated' |
	'deleted' |
	'likeupdate' |
	'newcomment' |
	'commentheartupdate';

export interface DeletedPostEventPayload {
	id: string;
	user_id: string;
}

export interface LikeUpdateEventPayload {
	post_id: string;
	like_count: number;
}
