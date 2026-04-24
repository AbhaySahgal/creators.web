import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export type SessionKind = 'call' | 'chat';

export interface AgoraRtcCredentialsDTO {
	app_id: string;
	channel_name: string;
	uid: number;
	token: string;
	token_ttl_sec: number;
	expires_at: string;
	dummy?: true;
}

export interface CallSessionSnapshotDTO {
	id: string;
	room_id: string;
	initiator_id: string;
	state: string;
	offer?: unknown;
	answer?: unknown;
	ice: unknown[];
}

export interface SessionsRequestDTO {
	request_id: string;
	fan_user_id?: string;
	fan_display?: string;
	kind?: SessionKind;
	price_cents?: string;
	created_at?: string;
}

export interface SessionsAcceptedDTO {
	request_id: string;
	room_id: string;
	kind: SessionKind;
	call_session_id: string | null;
	session: CallSessionSnapshotDTO | null;
	agora: AgoraRtcCredentialsDTO | null;
}

export function request(creatorUserId: string, kind: SessionKind) {
	const reqId = makeRequestId('s');
	return wsClient.request<{ request_id: string, status: string, price_cents: string, kind: SessionKind }>(
		'sessions',
		reqId,
		`/request ${creatorUserId} ${kind}`
	);
}

export function accept(requestId: string) {
	const reqId = makeRequestId('s');
	return wsClient.request<SessionsAcceptedDTO>('sessions', reqId, `/accept ${requestId}`);
}

export function reject(requestId: string) {
	const reqId = makeRequestId('s');
	return wsClient.request<{ request_id: string, message?: string, alternatives?: unknown[] }>('sessions', reqId, `/reject ${requestId}`);
}

export function cancel(requestId: string) {
	const reqId = makeRequestId('s');
	return wsClient.request<{ ok: true }>('sessions', reqId, `/cancel ${requestId}`);
}

export function complete(requestId: string) {
	const reqId = makeRequestId('s');
	return wsClient.request<{ ok: true, alreadyCompleted?: true }>('sessions', reqId, `/complete ${requestId}`);
}

export function endSession(requestId: string) {
	const reqId = makeRequestId('s');
	return wsClient.request<{ ok: true, alreadyCompleted?: true, callEnded?: { session_id: string, room_id: string } }>('sessions', reqId, `/endsession ${requestId}`);
}

export function feedback(requestId: string, rating: number, comment?: string) {
	const reqId = makeRequestId('s');
	const args: string[] = ['/feedback', requestId, String(rating)];
	if (comment) args.push(comment);
	return wsClient.request<{ feedback: unknown }>('sessions', reqId, args.join(' '));
}
