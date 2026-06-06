import type { WsClient } from './wsClient';

export interface PaymentBalanceResponse {
	walletId: string;
	/** Minor units (INR paise) as string; same scale as ledger amount_cents. */
	balance_cents: string;
}

export interface LedgerTransactionRow {
	id: string;
	type: 'credit' | 'debit';
	amount_cents: string;
	balance_after_cents: string;
	reference_type: string;
	reference_id: string;
	meta: Record<string, unknown>;
	created_at: string;
}

export interface PaymentHistoryResponse {
	transactions: LedgerTransactionRow[];
	nextCursor: string | null;
}

export interface RazorpayOrderRow {
	id: string;
	razorpay_order_id: string;
	currency: string;
	amount_minor: string;
	status: string;
	created_at: string;
}

export interface PaymentOrdersResponse {
	orders: RazorpayOrderRow[];
}

export interface PaymentCreateOrderResponse {
	orderId: string;
	amountMinor: number;
	currency: string;
	keyId: string | null;
}

export interface PaymentConfirmResponse {
	ok: true;
	balance_after_cents: string;
	alreadyConfirmed?: true;
	/** Present when `purpose=subscription` flow is confirmed. */
	subscription?: Record<string, unknown>;
	/** Present when `purpose=ppv` flow is confirmed (if backend returns it). */
	post?: Record<string, unknown>;
	entitlement_id?: string;
}

export interface PaymentPpvUnlockResponse {
	entitlement_id: string;
	from_balance_after: string;
	already_owned: boolean;
}

export interface TipDTO {
	id: string;
	fan_user_id: string;
	creator_user_id: string;
	post_id: string | null;
	amount_cents: string;
	currency: string;
	created_at: string;
}

export interface PaymentTipResponse {
	tip: TipDTO;
	from_balance_after: string;
}

/** B8: `payment /tiplive` response. */
export interface PaymentTipLiveResponse {
	tip_id: string;
	from_balance_after: string;
	tip_total_minor: string;
}

const SVC = 'payment';

export function createPaymentWs(client: WsClient) {
	return {
		balance(): Promise<PaymentBalanceResponse> {
			return client.request(SVC, 'balance', []) as Promise<PaymentBalanceResponse>;
		},
		history(limit?: number, beforeCursor?: string): Promise<PaymentHistoryResponse> {
			const args: string[] = [];
			if (limit != null) args.push(String(limit));
			if (beforeCursor != null) args.push(beforeCursor);
			return client.request(SVC, 'history', args) as Promise<PaymentHistoryResponse>;
		},
		transactions(limit?: number, beforeCursor?: string): Promise<PaymentHistoryResponse> {
			const args: string[] = [];
			if (limit != null) args.push(String(limit));
			if (beforeCursor != null) args.push(beforeCursor);
			return client.request(SVC, 'transactions', args) as Promise<PaymentHistoryResponse>;
		},
		createOrder(
			amountMinor: string,
			currency?: string,
			extraArgs?: Record<string, string | number | boolean | null | undefined>
		): Promise<PaymentCreateOrderResponse> {
			const args: string[] = currency ? [amountMinor, currency] : [amountMinor];
			if (extraArgs) {
				for (const [k, v] of Object.entries(extraArgs)) {
					if (v === undefined) continue;
					if (v === null) args.push(`${k}=`);
					else args.push(`${k}=${String(v)}`);
				}
			}
			return client.request(SVC, 'createorder', args) as Promise<PaymentCreateOrderResponse>;
		},
		confirm(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): Promise<PaymentConfirmResponse> {
			return client.request(SVC, 'confirm', [razorpayOrderId, razorpayPaymentId, razorpaySignature]) as Promise<PaymentConfirmResponse>;
		},
		orders(limit?: number): Promise<PaymentOrdersResponse> {
			const args = limit != null ? [String(limit)] : [];
			return client.request(SVC, 'orders', args) as Promise<PaymentOrdersResponse>;
		},
		tip(creatorUserId: string, amountCents: string, postId?: string): Promise<PaymentTipResponse> {
			const creator = String(creatorUserId ?? '').trim();
			const amount = String(amountCents ?? '').trim();
			if (!/^\d+$/.test(creator)) throw new Error('creatorUserId must be digits only');
			if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw new Error('amountCents must be a positive integer string');
			const args: string[] = [creator, amount];
			const pid = String(postId ?? '').trim();
			if (pid) args.push(pid);
			return client.request(SVC, 'tip', args) as Promise<PaymentTipResponse>;
		},
		/** B8: `payment /tiplive <liveId> <amountCents> [idempotency_key=…]` */
		tipLive(
			liveId: string,
			amountCents: string,
			opts?: { idempotencyKey?: string }
		): Promise<PaymentTipLiveResponse> {
			const id = String(liveId ?? '').trim();
			const amount = String(amountCents ?? '').trim();
			if (!id) throw new Error('liveId is required');
			if (/\s/.test(id)) throw new Error('liveId must not contain whitespace');
			if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
				throw new Error('amountCents must be a positive integer string');
			}
			const args: string[] = [id, amount];
			const key = String(opts?.idempotencyKey ?? '').trim();
			if (key) args.push(`idempotency_key=${key}`);
			return client.request(SVC, 'tiplive', args) as Promise<PaymentTipLiveResponse>;
		},
		ppvUnlock(postId: string, idempotencyKey?: string): Promise<PaymentPpvUnlockResponse> {
			const id = String(postId ?? '').trim();
			if (!id) throw new Error('postId is required');
			if (/\s/.test(id)) throw new Error('postId must not contain whitespace');
			const key = idempotencyKey?.trim();
			const args = key ? [id, `idempotency_key=${key}`] : [id];
			return client.request(SVC, 'ppvunlock', args).then(json => {
				if (!json || typeof json !== 'object') throw new Error('Invalid payment /ppvunlock response');
				const o = json as Record<string, unknown>;
				const entitlement_id = typeof o.entitlement_id === 'string' ? o.entitlement_id.trim() : '';
				const from_balance_after = typeof o.from_balance_after === 'string' ? o.from_balance_after.trim() : '';
				if (!entitlement_id || !from_balance_after) {
					throw new Error('Invalid payment /ppvunlock response');
				}
				return {
					entitlement_id,
					from_balance_after,
					already_owned: o.already_owned === true,
				};
			});
		},
	};
}

export type PaymentWs = ReturnType<typeof createPaymentWs>;
