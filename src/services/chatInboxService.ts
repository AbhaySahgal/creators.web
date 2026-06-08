import type { WsClient } from './wsClient';
import type { Conversation } from '../types';
import type { ListConversationsResponse, ChatConversationRowDTO } from './chatWsTypes';

function assertLimit(limit: number): number {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new Error('limit must be an integer 1–100');
	}
	return limit;
}

/**
 * B7: `chat /listconversations [limit] [beforeCursor]`
 */
export function chatListConversations(
	ws: WsClient,
	ensureAuth: () => Promise<void>,
	limit: number,
	beforeCursor?: string | null
): Promise<ListConversationsResponse> {
	const lim = assertLimit(limit);
	return ensureAuth().then(() => {
		const args =
			beforeCursor != null && String(beforeCursor).trim() !== '' ?
				[String(lim), String(beforeCursor).trim()] :
				[String(lim)];
		return ws.request('chat', 'listconversations', args);
	}).then(json => json as ListConversationsResponse);
}

function isNumericInboxId(s: string): boolean {
	return /^\d+$/.test(s.trim());
}

/** Backend mute/pin expect `/^\d+$/` (chat inbox row id), not `room_id` UUID and not sessions booking `id`. */
export function resolveInboxRowIdForMutePin(conv: Conversation): string | undefined {
	if (conv.inboxNumericId && isNumericInboxId(conv.inboxNumericId)) return conv.inboxNumericId.trim();
	if (isNumericInboxId(conv.id)) return conv.id.trim();
	return undefined;
}

/** First numeric string among known extra keys on a list row (snake_case + camelCase). */
function firstNumericListField(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
	for (const k of keys) {
		const v = row[k];
		if (v == null) continue;
		if (typeof v !== 'string' && typeof v !== 'number') continue;
		const s = String(v).trim();
		if (isNumericInboxId(s)) return s;
	}
	return undefined;
}

const CHAT_INBOX_NUMERIC_KEYS = [
	'chat_conversation_id',
	'chatConversationId',
	'inbox_conversation_id',
	'inboxConversationId',
	'conversation_pk',
	'conversationPk',
	'dm_conversation_id',
	'dmConversationId',
	'thread_id',
	'threadId',
	'inbox_id',
	'inboxId',
] as const;

/** B7: `chat /muteconversation <numericInboxId> <true|false>` */
export function chatMuteConversation(
	ws: WsClient,
	ensureAuth: () => Promise<void>,
	conversationId: string,
	muted: boolean
): Promise<unknown> {
	const id = String(conversationId ?? '').trim();
	if (!id) return Promise.reject(new Error('conversationId required'));
	if (!isNumericInboxId(id)) {
		return Promise.reject(new Error('muteconversation requires a numeric inbox id'));
	}
	return ensureAuth().then(() =>
		ws.request('chat', 'muteconversation', [id, muted ? 'true' : 'false'])
	);
}

/** B7: `chat /pinconversation <numericInboxId> <true|false>` */
export function chatPinConversation(
	ws: WsClient,
	ensureAuth: () => Promise<void>,
	conversationId: string,
	pinned: boolean
): Promise<unknown> {
	const id = String(conversationId ?? '').trim();
	if (!id) return Promise.reject(new Error('conversationId required'));
	if (!isNumericInboxId(id)) {
		return Promise.reject(new Error('pinconversation requires a numeric inbox id'));
	}
	return ensureAuth().then(() =>
		ws.request('chat', 'pinconversation', [id, pinned ? 'true' : 'false'])
	);
}

export function mapConversationRowToConversation(
	selfUserId: string,
	selfName: string,
	selfAvatar: string,
	row: ChatConversationRowDTO
): Conversation {
	const ext = row as ChatConversationRowDTO & Record<string, unknown>;
	const other = row.other_user ?? ext.otherUser;
	const lastMsg = (row.last_message ?? ext.lastMessage) as ChatConversationRowDTO['last_message'] | null | undefined;
	const updatedAt = String(row.updated_at ?? ext.updatedAt ?? '').trim();
	const cid = String(row.conversation_id ?? ext.conversationId ?? '').trim();
	const rid = row.room_id != null ? String(row.room_id ?? ext.roomId ?? '').trim() : '';
	const rowPk = row.id != null ? String(row.id).trim() : '';
	const inboxAlt = row.inbox_id != null ? String(row.inbox_id ?? ext.inboxId ?? '').trim() : '';
	const bookingId = row.booking_id != null ? String(row.booking_id ?? ext.bookingId ?? '').trim() : '';

	let inboxNumericId = firstNumericListField(ext, CHAT_INBOX_NUMERIC_KEYS);
	if (!inboxNumericId && isNumericInboxId(inboxAlt)) inboxNumericId = inboxAlt.trim();
	if (!inboxNumericId && isNumericInboxId(cid)) inboxNumericId = cid.trim();
	if (!inboxNumericId && isNumericInboxId(rowPk)) {
		const bookingNumeric = isNumericInboxId(bookingId) ? bookingId.trim() : '';
		/** Sessions booking id often duplicates `id` but is not the chat inbox row for mute/pin. */
		if (!bookingNumeric || rowPk.trim() !== bookingNumeric) {
			inboxNumericId = rowPk.trim();
		}
	}

	/** Room UUID for joinroom /getmessages / routes. */
	const roomIdForChat =
		(rid && !isNumericInboxId(rid) ? rid.trim() : '') ||
		(cid && !isNumericInboxId(cid) ? cid.trim() : '');

	const convId = roomIdForChat || cid;

	const otherId = String(other?.id ?? '').trim();
	const otherName = String(other?.name ?? other?.username ?? 'User').trim() || 'User';
	const otherAvatar = typeof other?.avatar_url === 'string' ? other.avatar_url : '';

	return {
		id: convId,
		participantIds: [selfUserId, otherId].filter(Boolean),
		participantNames: [selfName, otherName],
		participantAvatars: [selfAvatar, otherAvatar],
		lastMessage: lastMsg?.body ?? '',
		lastMessageTime: lastMsg?.created_at ?? updatedAt,
		unreadCount: Number(row.unread_count ?? ext.unreadCount) || 0,
		isOnline: false,
		muted: Boolean(row.muted ?? ext.muted),
		pinned: Boolean(row.pinned ?? ext.pinned),
		conversationSource: 'server',
		...(inboxNumericId ? { inboxNumericId } : {}),
	};
}

export function sortInboxConversations(conversations: Conversation[]): Conversation[] {
	return [...conversations].sort((a, b) => {
		if (a.pinned && !b.pinned) return -1;
		if (!a.pinned && b.pinned) return 1;
		return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
	});
}
