import type { CreatorKycStatus, KYCApplication, KYCStatus } from '../types';
import type { CuratedTopSlotDto, KycApplicationDto, KycSubmitRequest } from './kycTypes';

function asString(v: unknown): string {
	if (typeof v === 'string') return v;
	if (typeof v === 'number') return String(v);
	return '';
}

function pickString(...values: unknown[]): string | null {
	for (const v of values) {
		if (typeof v === 'string' && v.trim()) return v;
	}
	return null;
}

export function mapKycStatusToCreator(status: unknown): CreatorKycStatus {
	const s = asString(status).toLowerCase();
	if (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'not_submitted') {
		return s;
	}
	return 'not_submitted';
}

export function mapKycStatusToUi(status: unknown): KYCStatus {
	return mapKycStatusToCreator(status);
}

export function kycApplicationToUi(dto: KycApplicationDto): KYCApplication {
	const status = mapKycStatusToUi(dto.status);
	const name = dto.name?.trim() || dto.full_name?.trim() || 'Creator';
	return {
		id: dto.id,
		creatorId: dto.user_id,
		creatorName: name,
		creatorEmail: dto.email?.trim() || '',
		creatorAvatar: dto.avatar_url?.trim() || '',
		submittedAt: dto.created_at,
		status,
		idFrontUrl: dto.doc_front_url?.trim() || '',
		idBackUrl: dto.doc_back_url?.trim() || '',
		selfieUrl: dto.selfie_url?.trim() || '',
		rejectionReason: dto.rejection_reason?.trim() || undefined,
	};
}

export function normalizeKycApplicationDto(raw: unknown): KycApplicationDto | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const id = asString(o.id);
	const userId = asString(o.user_id ?? o.userId ?? o.creator_id);
	if (!id || !userId) return null;
	return {
		id,
		user_id: userId,
		full_name: asString(o.full_name ?? o.fullName),
		status: mapKycStatusToCreator(o.status),
		doc_front_url: pickString(o.doc_front_url, o.id_front_url, o.idFrontUrl),
		doc_back_url: pickString(o.doc_back_url, o.id_back_url, o.idBackUrl),
		selfie_url: pickString(o.selfie_url, o.selfieUrl),
		rejection_reason: pickString(o.rejection_reason, o.rejectionReason),
		created_at: asString(o.created_at ?? o.createdAt ?? o.submitted_at),
		email: typeof o.email === 'string' ? o.email : null,
		name: typeof o.name === 'string' ? o.name : null,
		username: typeof o.username === 'string' ? o.username : null,
		avatar_url: pickString(o.avatar_url, o.avatar),
	};
}

export function normalizeAdminKycListResponse(json: unknown): {
	applications: KycApplicationDto[],
	nextCursor: string | null,
	pendingCount?: number,
} {
	const root = json as Record<string, unknown> | null;
	const list = Array.isArray(root?.applications) ? root.applications :
		Array.isArray(root?.items) ? root.items : [];
	const applications = list
		.map(normalizeKycApplicationDto)
		.filter((a): a is KycApplicationDto => Boolean(a));
	const nextCursor =
		typeof root?.nextCursor === 'string' ? root.nextCursor :
		typeof root?.next_cursor === 'string' ? root.next_cursor : null;
	const pendingCount =
		typeof root?.pendingCount === 'number' ? root.pendingCount :
		typeof root?.pending_count === 'number' ? root.pending_count : undefined;
	return { applications, nextCursor, pendingCount };
}

export function normalizeCuratedTopResponse(json: unknown): { slots: CuratedTopSlotDto[] } {
	const root = json as Record<string, unknown> | null;
	const list = Array.isArray(root?.slots) ? root.slots :
		Array.isArray(root?.curated) ? root.curated : [];
	const slots = list
		.map((row): CuratedTopSlotDto | null => {
			if (!row || typeof row !== 'object') return null;
			const o = row as Record<string, unknown>;
			const creatorUserId = asString(o.creator_user_id ?? o.creatorUserId ?? o.user_id);
			const rankRaw = o.rank ?? o.position;
			const rank = typeof rankRaw === 'number' ? rankRaw : Number(asString(rankRaw));
			if (!creatorUserId || !Number.isFinite(rank)) return null;
			return {
				creator_user_id: creatorUserId,
				rank,
				username: typeof o.username === 'string' ? o.username : null,
				name: typeof o.name === 'string' ? o.name : null,
				avatar_url: typeof o.avatar_url === 'string' ? o.avatar_url : null,
			};
		})
		.filter((s): s is CuratedTopSlotDto => Boolean(s))
		.sort((a, b) => a.rank - b.rank);
	return { slots };
}

/** KV args for `user /kycsubmit`. */
export function buildKycSubmitWsArgs(body: KycSubmitRequest): string[] {
	const args: string[] = [];
	const entries: Record<string, string | undefined> = {
		fullName: body.fullName,
		docFrontAssetId: body.docFrontAssetId,
		selfieAssetId: body.selfieAssetId,
		docBackAssetId: body.docBackAssetId,
		dob: body.dob,
		address: body.address,
	};
	for (const [k, v] of Object.entries(entries)) {
		if (!v?.trim()) continue;
		args.push(`${k}=${v.trim()}`);
	}
	return args;
}
