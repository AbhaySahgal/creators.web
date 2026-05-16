import type { AgoraRtcCredentials } from './sessionsWsTypes';
import type {
	LiveDTO,
	LiveListLiveResponse,
	LiveStats,
	LiveTrendingResponse,
	LiveVisibility,
	LiveWithAgora,
} from './liveWsTypes';

function asString(v: unknown): string {
	return typeof v === 'string' ? v :
		typeof v === 'number' ? String(v) :
		'';
}

function asNumber(v: unknown, fallback = 0): number {
	if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
	if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Math.max(0, parseInt(v.trim(), 10));
	return fallback;
}

function parseVisibility(v: unknown): LiveVisibility {
	const s = asString(v).toLowerCase();
	if (s === 'followers' || s === 'subscribers') return s;
	return 'everyone';
}

function parseStatus(v: unknown): 'live' | 'ended' {
	return asString(v).toLowerCase() === 'ended' ? 'ended' : 'live';
}

export function normalizeLiveStats(raw: unknown): LiveStats | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const liveId = asString(o.live_id ?? o.liveId);
	if (!liveId) return null;
	return {
		live_id: liveId,
		viewer_count: asNumber(o.viewer_count ?? o.viewerCount),
		like_count: asNumber(o.like_count ?? o.likeCount),
		tip_total_minor: asNumber(o.tip_total_minor ?? o.tipTotalMinor),
	};
}

export function statsFromLiveDto(dto: LiveDTO): LiveStats | null {
	if (dto.viewer_count === undefined && dto.like_count === undefined && dto.tip_total_minor === undefined) {
		return null;
	}
	return {
		live_id: dto.live_id,
		viewer_count: dto.viewer_count ?? 0,
		like_count: dto.like_count ?? 0,
		tip_total_minor: dto.tip_total_minor ?? 0,
	};
}

export function normalizeLiveDto(raw: unknown): LiveDTO | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const liveId = asString(o.live_id ?? o.liveId ?? o.id);
	const creatorUserId = asString(o.creator_user_id ?? o.creatorUserId);
	const roomId = asString(o.room_id ?? o.roomId);
	if (!liveId) return null;
	return {
		live_id: liveId,
		creator_user_id: creatorUserId,
		room_id: roomId,
		visibility: parseVisibility(o.visibility),
		title: asString(o.title),
		status: parseStatus(o.status),
		started_at: asString(o.started_at ?? o.startedAt) || new Date().toISOString(),
		ended_at: typeof o.ended_at === 'string' ? o.ended_at :
		typeof o.endedAt === 'string' ? o.endedAt :
		o.ended_at === null ? null : undefined,
		banner_url: typeof o.banner_url === 'string' ? o.banner_url :
		typeof o.bannerUrl === 'string' ? o.bannerUrl : null,
		banner_asset_id: typeof o.banner_asset_id === 'string' ? o.banner_asset_id :
		typeof o.bannerAssetId === 'string' ? o.bannerAssetId : null,
		viewer_count: asNumber(o.viewer_count ?? o.viewerCount, 0),
		like_count: asNumber(o.like_count ?? o.likeCount, 0),
		tip_total_minor: asNumber(o.tip_total_minor ?? o.tipTotalMinor, 0),
		created_at: asString(o.created_at ?? o.createdAt) || undefined,
		updated_at: asString(o.updated_at ?? o.updatedAt) || undefined,
	};
}

function normalizeAgora(raw: unknown): AgoraRtcCredentials | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const appId = asString(o.app_id ?? o.appId);
	if (!appId) return null;
	return {
		app_id: appId,
		channel_name: asString(o.channel_name ?? o.channelName),
		uid: asNumber(o.uid, 0),
		token: asString(o.token),
		token_ttl_sec: asNumber(o.token_ttl_sec ?? o.tokenTtlSec, 3600),
		expires_at: asString(o.expires_at ?? o.expiresAt) || new Date(Date.now() + 3_600_000).toISOString(),
	};
}

/** Parse golive/joinlive JSON (flat or nested `{ live, agora, stats }`). */
export function normalizeLiveWithAgora(json: unknown): LiveWithAgora {
	const root = json && typeof json === 'object' ? json as Record<string, unknown> : {};
	const nestedLive = root.live ?? root;
	const dto = normalizeLiveDto(nestedLive) ?? normalizeLiveDto(root);
	if (!dto) throw new Error('Invalid live response');
	const agora = normalizeAgora(root.agora ?? (nestedLive !== root ? undefined : root.agora));
	if (!agora) throw new Error('Missing Agora credentials in live response');
	const stats =
		normalizeLiveStats(root.stats) ??
		statsFromLiveDto(dto);
	return { ...dto, agora, stats: stats ?? undefined };
}

function normalizeLiveListBody(json: unknown): { lives: LiveDTO[], nextCursor: string | null } {
	const root = json && typeof json === 'object' ? json as Record<string, unknown> : {};
	const arr = Array.isArray(root.lives) ? root.lives :
		Array.isArray(root.trending) ? root.trending :
		Array.isArray(root.items) ? root.items :
		[];
	const lives = arr.map(normalizeLiveDto).filter((l): l is LiveDTO => Boolean(l));
	const nextCursor =
		typeof root.nextCursor === 'string' ? root.nextCursor :
		typeof root.next_cursor === 'string' ? root.next_cursor :
		null;
	return { lives, nextCursor };
}

export function normalizeLiveListLiveResponse(json: unknown): LiveListLiveResponse {
	const { lives, nextCursor } = normalizeLiveListBody(json);
	return { lives, nextCursor };
}

export function normalizeLiveTrendingResponse(json: unknown): LiveTrendingResponse {
	return normalizeLiveListLiveResponse(json);
}
