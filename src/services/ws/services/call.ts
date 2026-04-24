import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export interface CallSessionSnapshotDTO {
	id: string;
	room_id: string;
	initiator_id: string;
	state: string;
	offer?: unknown;
	answer?: unknown;
	ice: unknown[];
}

export function start(roomUuid: string) {
	const reqId = makeRequestId('ca');
	return wsClient.request<CallSessionSnapshotDTO>('call', reqId, `/start ${roomUuid}`);
}

export function offer(sessionId: string, payload: unknown) {
	const reqId = makeRequestId('ca');
	return wsClient.request<{ ok: true }>('call', reqId, `/offer ${sessionId} ${JSON.stringify(payload)}`);
}

export function answer(sessionId: string, payload: unknown) {
	const reqId = makeRequestId('ca');
	return wsClient.request<{ ok: true }>('call', reqId, `/answer ${sessionId} ${JSON.stringify(payload)}`);
}

export function ice(sessionId: string, payload: unknown) {
	const reqId = makeRequestId('ca');
	return wsClient.request<{ ok: true }>('call', reqId, `/ice ${sessionId} ${JSON.stringify(payload)}`);
}

export function end(sessionId: string) {
	const reqId = makeRequestId('ca');
	return wsClient.request<{ ok: true }>('call', reqId, `/end ${sessionId}`);
}
