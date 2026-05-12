import type { Creator } from '../types';
import { inrRupeesToMinor, minorStringToInrNumber } from '../utils/money';
import type { CreatorProfileDTO, CreatorSummaryDTO } from './creatorWsTypes';

function normalizeSubscriptionPriceMinor(dto: CreatorProfileDTO): string | null {
	const raw = dto.subscription_price_minor;
	if (raw == null) return null;
	const t = String(raw).trim();
	if (!/^\d+$/.test(t)) return null;
	return t;
}

/** Minor units string for subscribe / wallet checks: API field when valid, else catalog rupees → paise. */
export function creatorSubscriptionMinorUnits(c: Pick<Creator, 'subscriptionPrice' | 'subscriptionPriceMinor'>): string {
	const m = c.subscriptionPriceMinor?.trim();
	if (m && /^\d+$/.test(m)) return m;
	return inrRupeesToMinor(c.subscriptionPrice);
}

/** Map WS creator row → UI Creator (fill required Creator fields with defaults). */
export function creatorProfileDtoToCreator(dto: CreatorProfileDTO, base?: Partial<Creator>): Creator {
	const category0 = dto.categories[0] ?? 'Lifestyle';
	const minorStr = normalizeSubscriptionPriceMinor(dto);
	const subscriptionPrice =
		minorStr != null ? minorStringToInrNumber(minorStr) : (base?.subscriptionPrice ?? 0);
	return {
		id: dto.user_id,
		email: base?.email ?? '',
		name: dto.name,
		username: dto.username,
		avatar: dto.avatar_url ?? '',
		bio: dto.bio ?? '',
		banner: dto.banner_url ?? '',
		subscriptionPrice,
		subscriptionPriceMinor: minorStr ?? undefined,
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
		perMinuteRate: base?.perMinuteRate ?? 0,
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
