export interface CreatorSummaryDTO {
	id: string;
	user_id: string;
	username: string;
	name: string;
	avatar_url: string | null;
	categories: string[];
}

export interface CreatorProfileDTO extends CreatorSummaryDTO {
	bio: string | null;
	banner_url: string | null;
	socials: Record<string, unknown> | null;
	created_at: string;
	/** Optional extra fields present on some backends (used for follow UI). */
	follower_count?: number | string | null;
	is_followed?: boolean | null;
	/** Integer string, minor units; authoritative for subscription debit (missing_apis_v1). */
	subscription_price_minor?: string | null;
}

export interface CreatorListResponse {
	creators: CreatorSummaryDTO[];
	nextCursor: string | null;
}

export interface CreatorGetResponse {
	creator: CreatorProfileDTO | null;
}

export interface CreatorUpsertResponse {
	creator: CreatorProfileDTO;
}

/** `creator /listfollowers` row (missing_apis_v1 UserSummary). */
export interface CreatorFollowerUserSummary {
	id: string;
	name: string;
	username: string;
	avatar_url: string | null;
}

export interface CreatorListFollowersResponse {
	followers: CreatorFollowerUserSummary[];
	nextCursor: string | null;
}
