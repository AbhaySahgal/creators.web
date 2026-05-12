import type { Creator } from '../types';
import type { CreatorProfileDTO, CreatorSummaryDTO } from './creatorWsTypes';

function normalizeMinorString(v: unknown): string | null {
	if (typeof v === 'string') {
		const t = v.trim();
		return /^\d+$/.test(t) ? t : null;
	}
	if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return String(Math.floor(v));
	return null;
}

function minorToInrRupees(minor: string | null): number {
	if (!minor) return 0;
	// UI uses rupees number for some flows; keep it as display-only.
	const n = Number(minor);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n / 100;
}

/** Map WS creator row → UI Creator (fill required Creator fields with defaults). */
export function creatorProfileDtoToCreator(dto: CreatorProfileDTO, base?: Partial<Creator>): Creator {
	const category0 = dto.categories[0] ?? 'Lifestyle';
	const subscriptionPriceMinor = normalizeMinorString(dto.subscription_price_minor);
	const perMinuteRateMinor = normalizeMinorString(dto.per_minute_rate);
	return {
		id: dto.user_id,
		email: base?.email ?? '',
		name: dto.name,
		username: dto.username,
		avatar: dto.avatar_url ?? '',
		bio: dto.bio ?? '',
		banner: dto.banner_url ?? '',
		subscriptionPriceMinor: subscriptionPriceMinor ?? undefined,
		perMinuteRateMinor: perMinuteRateMinor ?? undefined,
		subscriptionPrice: subscriptionPriceMinor ? minorToInrRupees(subscriptionPriceMinor) : (base?.subscriptionPrice ?? 0),
		totalEarnings: base?.totalEarnings ?? 0,
		monthlyEarnings: base?.monthlyEarnings ?? 0,
		tipsReceived: base?.tipsReceived ?? 0,
		subscriberCount: base?.subscriberCount ?? 0,
		kycStatus: base?.kycStatus ?? 'approved',
		isKYCVerified: base?.isKYCVerified ?? true,
		category: category0,
		isOnline: base?.isOnline ?? false,
		postCount: base?.postCount ?? 0,
		likeCount: base?.likeCount ?? 0,
		monthlyStats: base?.monthlyStats ?? [],
		perMinuteRate: perMinuteRateMinor ? minorToInrRupees(perMinuteRateMinor) : (base?.perMinuteRate ?? 0),
		liveStreamEnabled: base?.liveStreamEnabled ?? false,
		role: 'creator',
		createdAt: dto.created_at,
		isAgeVerified: base?.isAgeVerified ?? true,
		status: base?.status ?? 'active',
		walletBalanceMinor: base?.walletBalanceMinor ?? '0',
	};
}

/** Creator card row id is `creators.id` (PK); UI may route by `user_id` — see Explore / profile wiring. */
export function creatorSummaryToCardCreator(dto: CreatorSummaryDTO, base?: Partial<Creator>): Creator {
	const fakeProfile: CreatorProfileDTO = {
		...dto,
		bio: null,
		banner_url: null,
		socials: null,
		created_at: base?.createdAt ?? new Date().toISOString(),
	};
	return creatorProfileDtoToCreator(fakeProfile, base);
}
