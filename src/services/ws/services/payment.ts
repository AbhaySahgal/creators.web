import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export interface PaymentBalanceResponse {
	walletId: string;
	balance_cents: string;
}

export interface PaymentTransactionDTO {
	id: string;
	type: 'credit' | 'debit';
	amount_cents: string;
	balance_after_cents: string;
	reference_type: string;
	reference_id: string;
	meta: Record<string, unknown>;
	created_at: string;
}

export function balance() {
	const reqId = makeRequestId('pay');
	return wsClient.request<PaymentBalanceResponse>('payment', reqId, '/balance');
}

export function history(limit?: number, beforeCursor?: string) {
	const reqId = makeRequestId('pay');
	const args: string[] = ['/history'];
	if (limit) args.push(String(limit));
	if (beforeCursor) args.push(beforeCursor);
	return wsClient.request<{ transactions: PaymentTransactionDTO[], nextCursor: string | null }>('payment', reqId, args.join(' '));
}

export function createOrder(amountMinor: number, currency = 'INR') {
	const reqId = makeRequestId('pay');
	return wsClient.request<{ orderId: string, amountMinor: number, currency: string, keyId: string | null }>(
		'payment',
		reqId,
		`/createorder ${amountMinor} ${currency}`
	);
}

export function confirm(orderId: string, paymentId: string, signature: string) {
	const reqId = makeRequestId('pay');
	return wsClient.request<{ ok: true, balance_after_cents: string, alreadyConfirmed?: true }>(
		'payment',
		reqId,
		`/confirm ${orderId} ${paymentId} ${signature}`
	);
}

export function orders(limit?: number) {
	const reqId = makeRequestId('pay');
	const args: string[] = ['/orders'];
	if (limit) args.push(String(limit));
	return wsClient.request<{ orders: { id: string, razorpay_order_id: string, currency: string, amount_minor: string, status: string, created_at: string }[] }>(
		'payment',
		reqId,
		args.join(' ')
	);
}
