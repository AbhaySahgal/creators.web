import type { CreatorKycStatus } from '../types';

export interface PayoutBalance {
	availableCents: string;
	pendingCents: string;
	currency: string;
	kycStatus: CreatorKycStatus;
}

export interface PayoutWithdrawResult {
	withdrawalId: string;
	status: string;
}

export interface PayoutWithdrawalRow {
	id: string;
	amountCents: string;
	status: string;
	currency: string;
	createdAt: string;
}

export interface PayoutHistory {
	withdrawals: PayoutWithdrawalRow[];
	nextCursor: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
	return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function asString(v: unknown): string {
	if (typeof v === 'string') return v;
	if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
	return '';
}

function normalizeKycStatus(raw: unknown): CreatorKycStatus {
	const s = asString(raw).toLowerCase();
	if (s === 'approved') return 'approved';
	if (s === 'pending') return 'pending';
	if (s === 'rejected') return 'rejected';
	return 'not_submitted';
}

export function normalizePayoutBalance(body: unknown): PayoutBalance {
	const root = asRecord(body) ?? {};
	return {
		availableCents: asString(root.available_cents ?? root.availableCents) || '0',
		pendingCents: asString(root.pending_cents ?? root.pendingCents) || '0',
		currency: asString(root.currency) || 'INR',
		kycStatus: normalizeKycStatus(root.kyc_status ?? root.kycStatus),
	};
}

export function normalizePayoutWithdraw(body: unknown): PayoutWithdrawResult {
	const root = asRecord(body) ?? {};
	return {
		withdrawalId: asString(root.withdrawal_id ?? root.withdrawalId ?? root.id),
		status: asString(root.status) || 'pending',
	};
}

export function normalizePayoutWithdrawalRow(raw: unknown): PayoutWithdrawalRow | null {
	const row = asRecord(raw);
	if (!row) return null;
	const id = asString(row.id ?? row.withdrawal_id ?? row.withdrawalId);
	if (!id) return null;
	return {
		id,
		amountCents: asString(row.amount_cents ?? row.amountCents) || '0',
		status: asString(row.status) || 'pending',
		currency: asString(row.currency) || 'INR',
		createdAt: asString(row.created_at ?? row.createdAt),
	};
}

export function normalizePayoutHistory(body: unknown): PayoutHistory {
	const root = asRecord(body) ?? {};
	const rawList = root.withdrawals;
	const withdrawals = Array.isArray(rawList) ?
		rawList.map(normalizePayoutWithdrawalRow).filter((w): w is PayoutWithdrawalRow => w != null) :
		[];
	const next = root.nextCursor ?? root.next_cursor;
	const nextCursor = typeof next === 'string' && next.trim() ? next.trim() : null;
	return { withdrawals, nextCursor };
}
