import type { Comment, Post, PostType } from '../types';
import { resolveUnlockPriceMinor, type CommentDTO, type PostDTO } from './postsTypes';

export interface CreatorDisplay {
	name: string;
	avatar: string;
	username: string;
}

function viewerSeesFullPost(dto: PostDTO, currentUserId: string | undefined): boolean {
	if (currentUserId && String(dto.user_id) === currentUserId) return true;
	if (dto.visibility === 'public') return true;
	return dto.is_unlocked_for_viewer === true;
}

function mapMediaFromDto(dto: PostDTO, unlocked: boolean): {
	type: PostType,
	mediaUrl?: string,
	thumbnailUrl?: string,
} {
	const media0 = dto.media?.[0];
	if (!media0) return { type: 'text' };
	const type: PostType = media0.type === 'video' ? 'video' : 'image';
	const thumb =
		typeof media0.thumbnail_url === 'string' && media0.thumbnail_url.trim() ?
			media0.thumbnail_url.trim() :
			undefined;
	const url = typeof media0.url === 'string' ? media0.url.trim() : '';
	if (!unlocked && !url) {
		return { type, thumbnailUrl: thumb };
	}
	if (url) {
		return { type, mediaUrl: url, thumbnailUrl: thumb ?? url };
	}
	return { type, thumbnailUrl: thumb };
}

function parseAccessReason(raw: string | null | undefined): string | undefined {
	if (raw == null || typeof raw !== 'string') return undefined;
	const t = raw.trim();
	return t || undefined;
}

export function postDtoToPost(
	dto: PostDTO,
	creator: CreatorDisplay | undefined,
	likedByMe: boolean,
	currentUserId: string | undefined,
	partial?: Partial<Post>
): Post {
	const creatorId = String(dto.user_id);
	const isPPV = dto.visibility === 'ppv';
	const unlocked = viewerSeesFullPost(dto, currentUserId);
	const isLocked = dto.visibility !== 'public' && !unlocked;
	const { type, mediaUrl, thumbnailUrl } = mapMediaFromDto(dto, unlocked);
	const unlockPriceMinor = resolveUnlockPriceMinor(dto);
	const isPPVWithPrice = isPPV && unlockPriceMinor != null;
	const ppvPriceRupees =
		isPPVWithPrice ? Number(unlockPriceMinor) / 100 :
		isPPV && dto.ppv_price_usd_cents != null ? dto.ppv_price_usd_cents / 100 :
		undefined;

	const name = creator?.name ?? 'Creator';
	const avatar = creator?.avatar ?? '';
	const username = creator?.username ?? 'creator';

	const likedBy =
		likedByMe && currentUserId ? [currentUserId] : [];

	const unlockedBy =
		unlocked && currentUserId ? [currentUserId] : (partial?.unlockedBy ?? []);

	return {
		id: dto.id,
		creatorId,
		creatorName: name,
		creatorAvatar: avatar,
		creatorUsername: username,
		type,
		text: dto.text ?? '',
		mediaUrl,
		thumbnailUrl,
		isLocked,
		isPPV,
		isUnlockedForViewer: unlocked,
		unlockPriceMinor: unlockPriceMinor ?? undefined,
		accessReason: parseAccessReason(dto.access_reason),
		ppvPrice: ppvPriceRupees,
		likes: dto.like_count ?? 0,
		likedBy,
		comments: partial?.comments ?? [],
		commentCount: dto.comment_count ?? 0,
		createdAt: dto.created_at,
		isPinned: partial?.isPinned ?? false,
		unlockedBy,
	};
}

export function mergePostDtoIntoPost(
	existing: Post,
	dto: PostDTO,
	creator: CreatorDisplay | undefined,
	currentUserId: string | undefined
): Post {
	const likedByMe = currentUserId ? existing.likedBy.includes(currentUserId) : false;
	const mapped = postDtoToPost(dto, creator, likedByMe, currentUserId, {
		comments: existing.comments,
		isPinned: existing.isPinned,
		unlockedBy: existing.unlockedBy,
	});
	return {
		...mapped,
		comments: existing.comments,
		commentCount: dto.comment_count ?? existing.commentCount,
		isPinned: existing.isPinned,
		creatorName: creator?.name ?? existing.creatorName,
		creatorAvatar: creator?.avatar ?? existing.creatorAvatar,
		creatorUsername: creator?.username ?? existing.creatorUsername,
	};
}

/**
 * Creator-scoped comment lists sometimes echo the post owner's role label instead of the
 * commenter's identity. Treat those as absent so we use profile lookup or `User ·…` fallback.
 */
function isEchoedPostAuthorPlaceholder(value: string): boolean {
	const t = value.trim();
	if (!t) return true;
	if (t === 'Creator') return true;
	if (t.toLowerCase() === 'creator') return true;
	return false;
}

function commentAuthorNameFromDto(dto: CommentDTO): string | null {
	// Prefer typed fields (spec), then any extra keys the gateway forwards.
	const typed: (string | null | undefined)[] = [
		dto.display_name,
		dto.user_display_name,
		dto.name,
		dto.user_name,
		dto.username,
	];
	for (const v of typed) {
		if (typeof v !== 'string') continue;
		if (isEchoedPostAuthorPlaceholder(v)) continue;
		const t = v.trim();
		if (t) return t;
	}
	const raw = dto as unknown as Record<string, unknown>;
	for (const key of [
		'author_display', 'fan_display', 'fan_name', 'author_name',
		'userDisplayName', 'displayName', 'userName', 'authorName',
	] as const) {
		const v = raw[key];
		if (typeof v !== 'string') continue;
		if (isEchoedPostAuthorPlaceholder(v)) continue;
		const t = v.trim();
		if (t) return t;
	}
	return null;
}

function commentAuthorAvatarFromDto(dto: CommentDTO): string | null {
	const typed: (string | null | undefined)[] = [dto.avatar_url, dto.user_avatar_url];
	for (const v of typed) {
		if (typeof v === 'string') {
			const t = v.trim();
			if (t) return t;
		}
	}
	const raw = dto as unknown as Record<string, unknown>;
	for (const key of ['user_avatar', 'avatarUrl', 'userAvatar'] as const) {
		const v = raw[key];
		if (typeof v === 'string') {
			const t = v.trim();
			if (t) return t;
		}
	}
	return null;
}

/** Placeholder profile used while resolving creator rows — must not look like the post author. */
function isUnknownUserProfilePlaceholder(p: CreatorDisplay | undefined): boolean {
	if (!p) return false;
	return p.username === 'creator' && p.name === 'Creator';
}

export function commentDtoToComment(dto: CommentDTO, profile: CreatorDisplay | undefined): Comment {
	const userId = String(dto.user_id);
	const pid = dto.parent_comment_id;
	const text = String(dto.text ?? '').replace(/\\n/g, '\n');
	const fromDto = commentAuthorNameFromDto(dto);
	const fromDtoAvatar = commentAuthorAvatarFromDto(dto);
	const prof =
		profile && !isUnknownUserProfilePlaceholder(profile) ? profile : undefined;
	const tail = userId.replace(/-/g, '').slice(-6) || userId.slice(0, 8);
	const fallback = `User ·${tail}`;
	return {
		id: dto.id,
		userId,
		userName: fromDto ?? prof?.name ?? fallback,
		userAvatar: fromDtoAvatar ?? prof?.avatar ?? '',
		text,
		createdAt: dto.created_at,
		likes: 0,
		parentCommentId: pid == null || pid === '' ? null : String(pid),
		heartCount: typeof dto.heart_count === 'number' ? dto.heart_count : 0,
	};
}
