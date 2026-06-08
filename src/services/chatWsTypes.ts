export interface ChatMessageDTO {
	id: string;
	room_id: string;
	user_id: string;
	body: string;
	created_at: string;
}

export interface ChatTypingEventPayload {
	room_id: string;
	user_id: string;
	active: boolean;
}

export interface ChatPresenceEventPayload {
	room_id: string;
	user_id: string;
}

export interface ChatSeenEventPayload {
	room_id: string;
	user_id: string;
	last_message_id: string;
	seen_at: string;
}

export interface ChatJoinLeaveResponse {
	ok: boolean;
	room_id: string;
}

export interface ChatSendMsgAckResponse {
	ok: boolean;
	message: ChatMessageDTO;
}

export interface GetMessagesResponse {
	recentCache: ChatMessageDTO[];
	page: ChatMessageDTO[];
	nextCursor: string | null;
}

/** B7 `chat /listconversations` row. */
export interface ChatConversationOtherUserDTO {
	id: string;
	name: string;
	username: string;
	avatar_url: string | null;
}

export interface ChatConversationLastMessageDTO {
	body: string;
	sender_id: string;
	created_at: string;
}

export interface ChatConversationRowDTO {
	/** Numeric inbox row id (some backends require this for mute/pin). */
	id?: string | number;
	conversation_id: string;
	/** Chat room UUID when different from numeric `conversation_id` / `id`. */
	room_id?: string | null;
	/** Alternative numeric inbox id field name from some backends. */
	inbox_id?: string | number;
	/** Partner booking id when the API links a thread to sessions; not the chat mute/pin row id. */
	booking_id?: string | number;
	other_user: ChatConversationOtherUserDTO;
	last_message: ChatConversationLastMessageDTO | null;
	unread_count: number;
	muted: boolean;
	pinned: boolean;
	updated_at: string;
}

export interface ListConversationsResponse {
	conversations: ChatConversationRowDTO[];
	nextCursor: string | null;
}
