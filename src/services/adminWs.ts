import type { WsClient } from './wsClient';
import type {
	AdminAnalyticsTotalsResponse,
	AdminListKycResponse,
	AdminListReportsResponse,
	AdminListUsersResponse,
	AdminOverviewResponse,
	AdminRevenueBreakdownResponse,
	AdminRevenueSeriesResponse,
	AdminSetUserStatusResponse,
	AdminTopCreatorsResponse,
	AdminTopEarnersResponse,
} from './adminWsTypes';
import type { AccountStatus } from '../types';

const SVC = 'admin' as const;

function asJson<T>(v: unknown): T {
	return v as T;
}

/**
 * `/listusers [q] [role] [status] [limit] [cursor]` — positional; empty `q` uses `""` when other args are needed (see creatorWsService).
 */
export function buildListUsersCommand(opts: {
	q?: string;
	role?: 'all' | 'fan' | 'creator' | 'admin';
	status?: 'all' | 'active' | 'suspended' | 'banned';
	limit?: number;
	cursor?: string | null;
}): string {
	const role = opts.role ?? 'all';
	const status = opts.status ?? 'all';
	const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
	const q = opts.q?.trim() ?? '';
	const cur = opts.cursor?.trim() ?? '';
	if (!q && role === 'all' && status === 'all' && (opts.limit == null || limit === 30) && !cur) {
		return '/listusers';
	}
	const parts: string[] = ['/listusers'];
	parts.push(q || '""');
	parts.push(role, status, String(limit));
	if (cur) parts.push(cur);
	return parts.join(' ');
}

export function adminListUsers(ws: WsClient, opts: Parameters<typeof buildListUsersCommand>[0]): Promise<AdminListUsersResponse> {
	return ws.request(SVC, buildListUsersCommand(opts), []).then(j => asJson<AdminListUsersResponse>(j));
}

export function adminSetUserStatus(
	ws: WsClient,
	userId: string,
	status: AccountStatus,
	reasonParts?: string[],
): Promise<AdminSetUserStatusResponse> {
	const args = [userId, status, ...(reasonParts?.length ? [reasonParts.join(' ')] : [])];
	return ws.request(SVC, '/setuserstatus', args).then(j => asJson<AdminSetUserStatusResponse>(j));
}

export function buildListKycCommand(
	filter: 'pending' | 'approved' | 'rejected' | 'all',
	limit?: number,
	cursor?: string | null,
): string {
	const lim = Math.min(100, Math.max(1, limit ?? 30));
	const cur = cursor?.trim() ?? '';
	if (filter === 'all' && (limit == null || lim === 30) && !cur) return '/listkyc';
	const parts = ['/listkyc', filter, String(lim)];
	if (cur) parts.push(cur);
	return parts.join(' ');
}

export function adminListKyc(
	ws: WsClient,
	filter: 'pending' | 'approved' | 'rejected' | 'all',
	limit?: number,
	cursor?: string | null,
): Promise<AdminListKycResponse> {
	return ws.request(SVC, buildListKycCommand(filter, limit, cursor), []).then(j => asJson<AdminListKycResponse>(j));
}

export function adminApproveKyc(ws: WsClient, applicationId: string): Promise<unknown> {
	return ws.request(SVC, '/approvekyc', [applicationId]);
}

export function adminRejectKyc(ws: WsClient, applicationId: string, reason: string): Promise<unknown> {
	return ws.request(SVC, '/rejectkyc', [applicationId, reason]);
}

export function buildListReportsCommand(opts: {
	status?: 'all' | 'pending' | 'resolved' | 'dismissed';
	target?: 'target' | 'none';
	limit?: number;
	cursor?: string | null;
}): string {
	const st = opts.status ?? 'all';
	const tgt = opts.target ?? 'none';
	const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
	const cur = opts.cursor?.trim() ?? '';
	if (st === 'all' && tgt === 'none' && (opts.limit == null || limit === 30) && !cur) return '/listreports';
	const parts = ['/listreports', st, tgt, String(limit)];
	if (cur) parts.push(cur);
	return parts.join(' ');
}

export function adminListReports(ws: WsClient, opts: Parameters<typeof buildListReportsCommand>[0]): Promise<AdminListReportsResponse> {
	return ws.request(SVC, buildListReportsCommand(opts), []).then(j => asJson<AdminListReportsResponse>(j));
}

export function adminResolveReport(ws: WsClient, reportId: string, actionTaken?: string, note?: string): Promise<unknown> {
	const args = [reportId, ...(actionTaken ? [actionTaken] : []), ...(note?.trim() ? [note.trim()] : [])];
	return ws.request(SVC, '/resolvereport', args);
}

export function adminDismissReport(ws: WsClient, reportId: string, note?: string): Promise<unknown> {
	const args = [reportId, ...(note?.trim() ? [note.trim()] : [])];
	return ws.request(SVC, '/dismissreport', args);
}

export function adminOverview(ws: WsClient): Promise<AdminOverviewResponse> {
	return ws.request(SVC, '/overview', []).then(j => asJson<AdminOverviewResponse>(j));
}

export function buildTopCreatorsCommand(
	limit?: number,
	sort?: 'monthlyEarnings' | 'totalEarnings' | 'subscriberCount',
): string {
	const lim = Math.min(100, Math.max(1, limit ?? 5));
	const s = sort ?? 'monthlyEarnings';
	if (lim === 5 && s === 'monthlyEarnings') return '/topcreators';
	return `/topcreators ${lim} ${s}`;
}

export function adminTopCreators(
	ws: WsClient,
	limit?: number,
	sort?: 'monthlyEarnings' | 'totalEarnings' | 'subscriberCount',
): Promise<AdminTopCreatorsResponse> {
	return ws.request(SVC, buildTopCreatorsCommand(limit, sort), []).then(j => asJson<AdminTopCreatorsResponse>(j));
}

export function adminAnalyticsTotals(ws: WsClient): Promise<AdminAnalyticsTotalsResponse> {
	return ws.request(SVC, '/analyticstotals', []).then(j => asJson<AdminAnalyticsTotalsResponse>(j));
}

export function adminRevenueSeries(ws: WsClient, months?: number): Promise<AdminRevenueSeriesResponse> {
	const m = months != null ? Math.min(36, Math.max(1, months)) : undefined;
	const cmd = m != null ? `/revenueseries ${m}` : '/revenueseries';
	return ws.request(SVC, cmd, []).then(j => asJson<AdminRevenueSeriesResponse>(j));
}

export function adminTopEarners(
	ws: WsClient,
	limit?: number,
	window?: 'all_time' | 'last_30d' | 'last_90d',
): Promise<AdminTopEarnersResponse> {
	const lim = Math.min(100, Math.max(1, limit ?? 5));
	const w = window ?? 'all_time';
	const cmd = lim === 5 && w === 'all_time' ? '/topearners' : `/topearners ${lim} ${w}`;
	return ws.request(SVC, cmd, []).then(j => asJson<AdminTopEarnersResponse>(j));
}

export function adminRevenueBreakdown(ws: WsClient): Promise<AdminRevenueBreakdownResponse> {
	return ws.request(SVC, '/revenuebreakdown', []).then(j => asJson<AdminRevenueBreakdownResponse>(j));
}
