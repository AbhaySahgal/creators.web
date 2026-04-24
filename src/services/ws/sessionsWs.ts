import type { WsMuxClient } from './WsMuxClient';

export type SessionType = 'chat' | 'audio' | 'video';

export interface SessionsRequestResponse {
	request_id: string;
	status: 'pending' | 'active' | 'ended' | string;
	price_cents?: number;
}

export interface SessionsAcceptResponse {
	request_id: string;
	room_id: string;
	started_at?: string;
	ends_at?: string;
	price_cents?: number;
}

export interface SessionsTimerPush {
	request_id: string;
	room_id: string;
	ends_at: string;
	remaining_sec?: number;
}

export interface SessionsEndedPush {
	request_id: string;
	room_id?: string;
	reason?: 'timeout' | string;
	alreadyCompleted?: boolean;
}

export interface SessionsRequestPush {
	request_id: string;
	fan_user_id: string;
	fan_display?: string;
	minutes?: number;
	session_type?: SessionType | string;
	price_cents?: number;
}

export interface SessionsFeedback {
	id: string;
	request_id: string;
	user_id: string;
	rating: number;
	comment?: string;
	created_at?: string;
}

export function sessionsRequest(
	mux: WsMuxClient,
	requestId: string,
	creatorUserId: string,
	type: SessionType,
	minutes: number
): Promise<SessionsRequestResponse> {
	return mux.sendRequest('sessions', `/request ${creatorUserId} ${type} ${minutes}`, { requestId })
		.then(payload => payload as SessionsRequestResponse);
}

export function sessionsAccept(
	mux: WsMuxClient,
	requestId: string,
	request_id: string
): Promise<SessionsAcceptResponse> {
	return mux.sendRequest('sessions', `/accept ${request_id}`, { requestId })
		.then(payload => payload as SessionsAcceptResponse);
}

export function sessionsComplete(
	mux: WsMuxClient,
	requestId: string,
	request_id: string
): Promise<{ ok: boolean, alreadyCompleted?: boolean }> {
	return mux.sendRequest('sessions', `/complete ${request_id}`, { requestId })
		.then(payload => payload as { ok: boolean, alreadyCompleted?: boolean });
}

export function sessionsFeedback(
	mux: WsMuxClient,
	requestId: string,
	request_id: string,
	rating: number,
	comment: string
): Promise<{ feedback: SessionsFeedback }> {
	const safeComment = comment.replace(/\s+/g, ' ').trim();
	return mux.sendRequest('sessions', `/feedback ${request_id} ${rating} ${safeComment}`, { requestId })
		.then(payload => payload as { feedback: SessionsFeedback });
}

