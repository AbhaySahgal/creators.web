import type { AgoraRtcCredentials } from './sessionsWsTypes';

/**
 * Backend live spec (`public_lives` table).
 *
 * Frames:
 * - Response: |live|<command>|<requestId>|<JSON>
 * - Event:    |live|<event>|<JSON>
 *
 * Commands:
 * - /golive <visibility> [title]
 * - /joinlive <liveId>
 * - /endlive
 * - /listlive
 * - /stats <liveId>
 * - /analytics <liveId>
 * - /myanalytics [from=…] [to=…]
 *
 * Events:
 * - live|started   (fanout to everyone OR targeted by visibility)
 * - live|ended
 * - live|statsupdate
 *
 * Chat for the live uses the existing `chat` service over the same `room_id`.
 */

export type LiveVisibility = 'everyone' | 'followers' | 'subscribers';

export type LiveStatus = 'live' | 'ended';

export interface LivePublic {
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
	tip_total_minor?: string;
	created_at?: string;
	updated_at?: string;
}

export interface LiveWithAgora extends LivePublic {
	agora: AgoraRtcCredentials;
}

/** C5 / push `live|statsupdate` */
export interface LiveStats {
	live_id: string;
	viewer_count: number;
	like_count: number;
	tip_total_minor: string;
}

export type LiveStatsUpdateEvent = LiveStats;

export interface LiveEndLiveResponse {
	ok: true;
	live: LivePublic;
}

export interface LiveListLiveResponse {
	lives: LivePublic[];
}

export type LiveStartedEvent = LivePublic;

export interface LiveEndedEvent {
	live_id: string;
	room_id: string;
	ended_at?: string;
}

/** C4: `live /analytics <liveId>` */
export interface LiveAnalyticsResponse {
	live_id: string;
	viewer_count: number;
	like_count: number;
	tip_total_minor: string;
	tip_count: number;
	tips_sum_cents: string;
	started_at?: string;
	ended_at?: string | null;
}

export interface LiveMyAnalyticsStreamRow {
	id: string;
	title?: string | null;
	viewer_count: number;
	tip_total_minor: string;
	started_at?: string;
	ended_at?: string | null;
}

/** C4: `live /myanalytics` */
export interface LiveMyAnalyticsResponse {
	stream_count: number;
	total_viewer_count: number;
	total_tip_minor: string;
	streams: LiveMyAnalyticsStreamRow[];
}
