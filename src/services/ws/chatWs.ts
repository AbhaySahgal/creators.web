import type { WsMuxClient } from './WsMuxClient';

export interface ChatJoinRoomResponse {
	ok: boolean;
	room_id: string;
}

export interface ChatMessage {
	id: string;
	room_id: string;
	user_id?: string;
	user_name?: string;
	user_avatar?: string;
	text?: string;
	content?: string;
	created_at?: string;
	createdAt?: string;
}

export interface ChatSendMsgResponse {
	ok: boolean;
	message: ChatMessage;
}

export function chatJoinRoom(mux: WsMuxClient, requestId: string, roomId: string): Promise<ChatJoinRoomResponse> {
	return mux.sendRequest('chat', `/joinroom ${roomId}`, { requestId })
		.then(payload => payload as ChatJoinRoomResponse);
}

export function chatSendMsg(mux: WsMuxClient, requestId: string, roomId: string, text: string): Promise<ChatSendMsgResponse> {
	const safeText = text.replace(/\s+/g, ' ').trim();
	return mux.sendRequest('chat', `/sendmsg ${roomId} ${safeText}`, { requestId })
		.then(payload => payload as ChatSendMsgResponse);
}

