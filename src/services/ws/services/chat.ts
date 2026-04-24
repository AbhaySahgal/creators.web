import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export interface ChatMessageDTO {
	id: string;
	room_id: string;
	user_id: string;
	body: string;
	created_at: string;
}

export function joinRoom(roomUuid: string) {
	const reqId = makeRequestId('ch');
	return wsClient.request<{ ok: true, room_id: string }>('chat', reqId, `/joinroom ${roomUuid}`);
}

export function leaveRoom(roomUuid: string) {
	const reqId = makeRequestId('ch');
	return wsClient.request<{ ok: true, room_id: string }>('chat', reqId, `/leaveroom ${roomUuid}`);
}

export function sendMsg(roomUuid: string, message: string) {
	const reqId = makeRequestId('ch');
	return wsClient.request<{ ok: true, message: ChatMessageDTO }>('chat', reqId, `/sendmsg ${roomUuid} ${message}`);
}

export function getMessages(roomUuid: string, limit?: number, beforeCursor?: string) {
	const reqId = makeRequestId('ch');
	const args = ['/getmessages', roomUuid];
	if (limit) args.push(String(limit));
	if (beforeCursor) args.push(beforeCursor);
	return wsClient.request<{ recentCache: ChatMessageDTO[], page: ChatMessageDTO[], nextCursor: string | null }>(
		'chat',
		reqId,
		args.join(' ')
	);
}

export function typing(roomUuid: string, active: boolean) {
	const reqId = makeRequestId('ch');
	return wsClient.request<{ ok?: true }>('chat', reqId, `/typing ${roomUuid} ${active ? 1 : 0}`);
}
