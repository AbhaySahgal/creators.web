/**
 * Types for admin WebSocket command responses (admin_flow_v1).
 * Shapes are permissive where the backend may add fields.
 */

import type { AccountStatus, UserRole } from '../types';

export type AdminListUsersRole = 'all' | 'fan' | 'creator' | 'admin';
export type AdminListUsersStatus = 'all' | 'active' | 'suspended' | 'banned';

export interface AdminListUserRow {
	id: string;
	email: string;
	name: string;
	avatar: string;
	role: UserRole;
	status?: AccountStatus;
	createdAt?: string;
	[key: string]: unknown;
}

export interface AdminListUsersResponse {
	items: AdminListUserRow[];
	nextCursor: string | null;
	totalMatching?: number;
	[key: string]: unknown;
}

export interface AdminSetUserStatusResponse {
	user: AdminListUserRow;
	[key: string]: unknown;
}

export type AdminKycFilter = 'pending' | 'approved' | 'rejected' | 'all';

export interface AdminKycListItem {
	applicationId?: string;
	id?: string;
	creatorId?: string;
	creatorName?: string;
	creatorEmail?: string;
	creatorAvatar?: string;
	submittedAt?: string;
	status?: string;
	idFrontUrl?: string;
	idBackUrl?: string;
	selfieUrl?: string;
	rejectionReason?: string;
	[key: string]: unknown;
}

export interface AdminListKycResponse {
	items: AdminKycListItem[];
	nextCursor: string | null;
	pendingCount?: number;
	[key: string]: unknown;
}

export type AdminReportListStatus = 'all' | 'pending' | 'resolved' | 'dismissed';
export type AdminReportTargetMode = 'target' | 'none';

export type AdminReportTargetType = 'post' | 'user' | 'message';

export interface AdminReportTargetPost {
	type?: 'post';
	text?: string;
	mediaUrl?: string;
	creatorName?: string;
	[key: string]: unknown;
}

export interface AdminReportTargetUser {
	type?: 'user';
	username?: string;
	avatar?: string;
	[key: string]: unknown;
}

export interface AdminReportTargetMessage {
	type?: 'message';
	[key: string]: unknown;
}

export type AdminReportTarget =
	| AdminReportTargetPost
	| AdminReportTargetUser
	| AdminReportTargetMessage
	| Record<string, unknown>;

export interface AdminReportRow {
	id: string;
	reporterId?: string;
	reporterName?: string;
	targetId?: string;
	targetType?: AdminReportTargetType;
	target?: AdminReportTarget;
	reason?: string;
	description?: string;
	status?: AdminReportListStatus;
	createdAt?: string;
	[key: string]: unknown;
}

export interface AdminListReportsResponse {
	items: AdminReportRow[];
	nextCursor: string | null;
	pendingCount?: number;
	[key: string]: unknown;
}

export type AdminResolveAction =
	| 'content_removed'
	| 'user_warned'
	| 'user_suspended'
	| 'user_banned'
	| 'no_action';

export interface AdminOverviewResponse {
	totalUsers?: number;
	activeCreators?: number;
	platformRevenueMinor?: string;
	pendingKycCount?: number;
	pendingReportsCount?: number;
	[key: string]: unknown;
}

export interface AdminTopCreatorRow {
	id?: string;
	userId?: string;
	name?: string;
	username?: string;
	avatar?: string;
	avatarUrl?: string;
	monthlyEarningsMinor?: string;
	totalEarningsMinor?: string;
	subscriberCount?: number;
	[key: string]: unknown;
}

export interface AdminTopCreatorsResponse {
	items: AdminTopCreatorRow[];
	[key: string]: unknown;
}

export interface AdminAnalyticsTotalsResponse {
	totalUsers?: number;
	activeCreators?: number;
	platformRevenueMinor?: string;
	[key: string]: unknown;
}

export interface AdminRevenueSeriesPoint {
	month?: string;
	label?: string;
	revenueMinor?: string;
	amountMinor?: string;
	[key: string]: unknown;
}

export interface AdminRevenueSeriesResponse {
	series?: AdminRevenueSeriesPoint[];
	points?: AdminRevenueSeriesPoint[];
	months?: AdminRevenueSeriesPoint[];
	[key: string]: unknown;
}

export interface AdminTopEarnerRow {
	id?: string;
	userId?: string;
	name?: string;
	username?: string;
	avatar?: string;
	earningsMinor?: string;
	[key: string]: unknown;
}

export interface AdminTopEarnersResponse {
	items: AdminTopEarnerRow[];
	[key: string]: unknown;
}

export interface AdminRevenueBreakdownResponse {
	subscriptionsMinor?: string;
	tipsMinor?: string;
	sessionsMinor?: string;
	ppvMinor?: string;
	bySource?: Record<string, string>;
	[key: string]: unknown;
}
