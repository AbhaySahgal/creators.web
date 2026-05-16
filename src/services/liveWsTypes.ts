import type { AgoraRtcCredentials } from './sessionsWsTypes';

/**
 * Command V2 live spec (`public_lives` table).
 *
 * Commands: /golive, /joinlive, /endlive, /listlive, /trending, /stats
 * Events: started, ended, statsupdate
 */

export type LiveVisibility = 'everyone' | 'followers' | 'subscribers';

export type LiveListFilter = 'all' | LiveVisibility;

export type LiveStatus = 'live' | 'ended';

/** B3/C3: full live row from golive, listlive, trending, started. */
export interface LiveDTO {
	live_id: string;
	creator_user_id: string;
	room_id: string;
	visibility: LiveVisibility;
	title: string;
	status: LiveStatus;
	started_at: string;
	ended_at?: string | null;
	banner_url?: string | null;
	banner_asset_id?: string | null;
	viewer_count?: number;
	like_count?: number;
	tip_total_minor?: number;
	created_at?: string;
	updated_at?: string;
}

/** Alias for discovery rows without Agora creds. */
export type LivePublic = LiveDTO;

/** C5: live counters snapshot. */
export interface LiveStats {
	live_id: string;
	viewer_count: number;
	like_count: number;
	tip_total_minor: number;
}

export interface LiveWithAgora extends LiveDTO {
	agora: AgoraRtcCredentials;
	stats?: LiveStats;
}

export interface LiveEndLiveResponse {
	ok: true;
	live: LiveDTO;
}

export interface LiveListLiveResponse {
	lives: LiveDTO[];
	nextCursor?: string | null;
}

export interface LiveTrendingResponse {
	lives: LiveDTO[];
	nextCursor?: string | null;
}

export interface LiveStatsResponse {
	stats: LiveStats;
}

export type LiveStartedEvent = LiveDTO;

export interface LiveEndedEvent {
	live_id: string;
	room_id: string;
	ended_at?: string;
}

export type LiveStatsUpdateEvent = LiveStats;
