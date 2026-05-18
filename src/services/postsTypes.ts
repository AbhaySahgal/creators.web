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
	/** Legacy field; prefer unlock_price_minor when present. */
	ppv_price_usd_cents: number | null;
	media: PostMediaDTO[];
	like_count: number;
	comment_count: number;
	created_at: string;
	updated_at: string;
}

export interface GetPostResponse {
	post: PostDTO;
}

export interface UnlockPostResponse {
	post: PostDTO;
	from_balance_after: string;
	already_owned: boolean;
}

export interface PpvUnlockPaymentResponse {
	entitlement_id: string;
	from_balance_after: string;
	already_owned: boolean;
}

function coercePostDto(v: unknown): PostDTO | null {
	if (!v || typeof v !== 'object') return null;
	return v as PostDTO;
}

export function parseGetPostResponse(json: unknown): GetPostResponse | null {
	if (!json || typeof json !== 'object') return null;
	const post = coercePostDto((json as Record<string, unknown>).post);
	if (!post?.id) return null;
	return { post };
}

export function parseUnlockPostResponse(json: unknown): UnlockPostResponse | null {
	if (!json || typeof json !== 'object') return null;
	const o = json as Record<string, unknown>;
	const post = coercePostDto(o.post);
	const from_balance_after = typeof o.from_balance_after === 'string' ? o.from_balance_after.trim() : '';
	if (!post?.id || !from_balance_after) return null;
	return {
		post,
		from_balance_after,
		already_owned: o.already_owned === true,
	};
}

export function parsePpvUnlockPaymentResponse(json: unknown): PpvUnlockPaymentResponse | null {
	if (!json || typeof json !== 'object') return null;
	const o = json as Record<string, unknown>;
	const entitlement_id = typeof o.entitlement_id === 'string' ? o.entitlement_id.trim() : '';
	const from_balance_after = typeof o.from_balance_after === 'string' ? o.from_balance_after.trim() : '';
	if (!entitlement_id || !from_balance_after) return null;
	return {
		entitlement_id,
		from_balance_after,
		already_owned: o.already_owned === true,
	};
}

/** Resolve PPV price in minor units from B6 or legacy fields. */
export function resolveUnlockPriceMinor(dto: PostDTO): string | null {
	const raw = dto.unlock_price_minor;
	if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return raw.trim();
	if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return String(Math.round(raw));
	if (dto.ppv_price_usd_cents != null && Number.isFinite(dto.ppv_price_usd_cents)) {
		return String(Math.round(dto.ppv_price_usd_cents));
	}
	return null;
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
