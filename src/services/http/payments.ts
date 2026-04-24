import { postJson } from './client';

export interface CreateRazorpayOrderRequest {
	amountMinor: number;
	currency?: 'INR';
	receipt?: string;
	notes?: Record<string, unknown>;
}

export interface CreateRazorpayOrderResponse {
	orderId: string;
	amountMinor: number;
	currency: string;
	keyId?: string | null;
}

export interface ConfirmRazorpayPaymentRequest {
	razorpayOrderId: string;
	razorpayPaymentId: string;
	razorpaySignature: string;
}

export function createRazorpayOrder(body: CreateRazorpayOrderRequest): Promise<CreateRazorpayOrderResponse> {
	return postJson<CreateRazorpayOrderResponse>('/payments/razorpay/orders', body, { auth: true });
}

export function confirmRazorpayPayment(body: ConfirmRazorpayPaymentRequest): Promise<{ ok: true }> {
	return postJson<{ ok: true }>('/payments/razorpay/confirm', body, { auth: true });
}
