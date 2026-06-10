import type { CreatorKycStatus } from '../types';

export type KycApplicationStatus = CreatorKycStatus;

export interface KycApplicationDto {
	id: string;
	user_id: string;
	full_name: string;
	status: KycApplicationStatus;
	doc_front_url?: string | null;
	doc_back_url?: string | null;
	selfie_url?: string | null;
	rejection_reason?: string | null;
	created_at: string;
	/** Optional display fields from admin list. */
	email?: string | null;
	name?: string | null;
	username?: string | null;
	avatar_url?: string | null;
}

export interface KycSubmitRequest {
	fullName: string;
	docFrontAssetId: string;
	selfieAssetId: string;
	docBackAssetId?: string;
	dob?: string;
	address?: string;
}

export interface KycSubmitResponse {
	application: {
		user_id: string,
		status: KycApplicationStatus,
		full_name: string,
	};
}

export interface AdminKycListResponse {
	applications: KycApplicationDto[];
	nextCursor: string | null;
	pendingCount?: number;
}

export interface KycStatusUpdatePush {
	status: KycApplicationStatus;
	rejection_reason?: string | null;
	user_id?: string;
}

export interface CuratedTopSlotDto {
	creator_user_id: string;
	rank: number;
	/** Optional display fields when returned from get. */
	username?: string | null;
	name?: string | null;
	avatar_url?: string | null;
}

export interface CuratedTopResponse {
	slots: CuratedTopSlotDto[];
}

export interface CuratedTopSetRequest {
	slots: { creatorUserId: string, rank: number }[];
}

export interface CreatorTopRowDto {
	id: string;
	user_id: string;
	username: string;
	name: string;
	avatar_url: string | null;
	categories: string[];
	rank: number;
	score: string;
	score_follower_term?: string;
	score_tips_minor_capped?: string;
	follower_count: number;
	tips_minor_last_30d?: string;
}

export interface CreatorTopResponse {
	creators: CreatorTopRowDto[];
	nextCursor: string | null;
}
