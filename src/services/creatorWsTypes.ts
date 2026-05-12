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
	/** Monthly subscription price in minor units (integer string) or null. */
	subscription_price_minor?: string | null;
	/** Timed-session rate in minor units per minute (integer number) or null. */
	per_minute_rate?: number | null;
	/** Optional extra fields present on some backends (used for follow UI). */
	follower_count?: number | string | null;
	is_followed?: boolean | null;
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
