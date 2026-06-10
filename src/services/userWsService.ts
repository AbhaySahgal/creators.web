import type { CreatorsMultiplexWs } from './creatorsMultiplexWs';
import type { User } from '../types';
import type { WsClient } from './wsClient';
import { normalizeMeUser, type CreateReportResponse, type ReportTargetType } from './creatorsApi';
import type { KycSubmitRequest, KycSubmitResponse } from './kycTypes';
import type { UserAuthenticateResponse } from './userWsTypes';
import { buildKycSubmitWsArgs } from './kycMap';

export interface UserUpdateProfileOpts {
	name?: string;
	username?: string;
	bio?: string;
	bannerUrl?: string;
	avatarUrl?: string;
	/** Per-minute rate in minor units (paise), same as HTTP `perMinuteRate`. */
	perMinuteRate?: number;
}

/** Build `user /updateprofile` KV command per Command V2 spec. */
export function buildUserUpdateProfileCommand(opts: UserUpdateProfileOpts): string {
	const parts: string[] = ['/updateprofile'];
	const pushKv = (key: string, value: string | number | undefined) => {
		if (value === undefined || value === null) return;
		const s = typeof value === 'string' ? value.trim() : String(value);
		if (!s) return;
		parts.push(`${key}=${s}`);
	};
	pushKv('name', opts.name);
	pushKv('username', opts.username);
	pushKv('bio', opts.bio);
	pushKv('banner_url', opts.bannerUrl);
	pushKv('avatar_url', opts.avatarUrl);
	if (opts.perMinuteRate != null && Number.isFinite(opts.perMinuteRate)) {
		parts.push(`per_minute_rate=${Math.round(opts.perMinuteRate)}`);
	}
	if (parts.length === 1) throw new Error('updateprofile requires at least one field');
	return parts.join(' ');
}

export function parseUserMeResponse(json: unknown): User | null {
	if (json == null || typeof json !== 'object') return null;
	const root = json as Record<string, unknown>;
	const userRaw = 'user' in root ? root.user : json;
	return normalizeMeUser(userRaw);
}

/** Bind JWT on an existing guest socket (token must be compact / no spaces). */
export function userWsAuthenticate(client: CreatorsMultiplexWs, jwt: string): Promise<UserAuthenticateResponse> {
	const t = jwt.trim();
	if (!t || t.includes(' ')) {
		return Promise.reject(new Error('Invalid JWT for WebSocket /authenticate'));
	}
	return client.send('user', `/authenticate ${t}`).then(json => json as UserAuthenticateResponse);
}

export function userWsMe(client: CreatorsMultiplexWs): Promise<User | null> {
	return client.send('user', '/me').then(json => parseUserMeResponse(json));
}

export function userWsUpdateProfile(
	client: CreatorsMultiplexWs,
	opts: UserUpdateProfileOpts
): Promise<User> {
	return client.send('user', buildUserUpdateProfileCommand(opts)).then(json => {
		const user = parseUserMeResponse(json);
		if (!user) throw new Error('updateprofile returned no user');
		return user;
	});
}

export function userWsLogout(client: CreatorsMultiplexWs): Promise<void> {
	return client.send('user', '/logout').then(() => {});
}

export function userWsKycSubmitWs(client: WsClient, body: KycSubmitRequest): Promise<KycSubmitResponse> {
	const args = buildKycSubmitWsArgs(body);
	if (args.length < 3) throw new Error('fullName and document asset ids are required');
	return client.request('user', 'kycsubmit', args) as Promise<KycSubmitResponse>;
}

export function userWsKycSubmitMultiplex(client: CreatorsMultiplexWs, body: KycSubmitRequest): Promise<KycSubmitResponse> {
	const args = buildKycSubmitWsArgs(body);
	if (args.length < 3) throw new Error('fullName and document asset ids are required');
	const cmd = `/kycsubmit ${args.join(' ')}`;
	return client.send('user', cmd).then(json => json as KycSubmitResponse);
}

function assertReportTargetType(v: string): ReportTargetType {
	const t = v.trim().toLowerCase();
	if (t === 'post' || t === 'comment' || t === 'message' || t === 'user' || t === 'live') return t;
	throw new Error(`Invalid report targetType: ${v}`);
}

function assertNumericTargetId(id: string): string {
	const s = String(id).trim();
	if (!/^\d+$/.test(s)) throw new Error('targetId must be a numeric id string');
	return s;
}

function parseSubmitReportResponse(data: unknown): CreateReportResponse {
	const o = data as Record<string, unknown> | null;
	if (o?.ok !== true) throw new Error('Invalid submitreport response');
	if (o.already_reported === true) return { ok: true, already_reported: true };
	const rid = o.reportId;
	if (typeof rid === 'string' && rid.length) return { ok: true, reportId: rid };
	throw new Error('Invalid submitreport response: missing reportId');
}

/**
 * Primary app socket (`WsClient`): `> user <rid>` + `/submitreport <targetType> <targetId> <reason…>`.
 * Reason is sent as trailing tokens (joined server-side with spaces). Use HTTP `POST /reports` when you need `details`.
 */
export function userWsSubmitReport(
	ws: WsClient,
	opts: { targetType: ReportTargetType, targetId: string, reason: string, requestId?: string }
): Promise<CreateReportResponse> {
	const targetType = assertReportTargetType(opts.targetType);
	const targetId = assertNumericTargetId(opts.targetId);
	const reason = opts.reason.trim().slice(0, 64);
	if (!reason.length) return Promise.reject(new Error('Reason is required'));
	const reasonTokens = reason.split(/\s+/).filter(Boolean);
	const args = [targetType, targetId, ...reasonTokens];
	return ws.request('user', 'submitreport', args, opts.requestId).then(parseSubmitReportResponse);
}
