export type PostVisibility = 'public' | 'subscribers' | 'ppv';

export interface PostMediaDTO {
	type: 'image' | 'video';
	url: string;
	thumbnail_url?: string;
	[key: string]: unknown;
}

export interface PostDTO {
	id: string;
	// Numeric id as string (per backend spec)
	user_id: string;
	text: string;
	visibility: PostVisibility;
	/** B6: minor units (e.g. INR paise) as string or number. */
	unlock_price_minor?: string | number | null;
	currency?: string | null;
	is_unlocked_for_viewer?: boolean;
	/** Server access hint (labels only; do not use for access control). */
	access_reason?: string | null;
	ppv_price_usd_cents: number | null;
	media: PostMediaDTO[];
	like_count: number;
	comment_count: number;
	created_at: string;
	updated_at: string;
}

/** B6 unlock price: positive integer string in minor units, or null. */
export function resolveUnlockPriceMinor(dto: PostDTO): string | null {
	const raw = dto.unlock_price_minor;
	if (raw == null) return null;
	const s = String(raw).trim();
	if (!s || s === '0') return null;
	return /^\d+$/.test(s) ? s : null;
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
}

export interface CommentHeartUpdatePayload {
	post_id: string;
	comment_id: string;
	heart_count: number;
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
