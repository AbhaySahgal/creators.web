import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSessions } from '../../context/SessionsContext';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { creatorsApi } from '../../services/creatorsApi';
import {
	chatListConversations,
	mapConversationRowToConversation,
} from '../../services/chatInboxService';
import type { ListConversationsResponse } from '../../services/chatWsTypes';

/**
 * Post-auth inbox sync (B7): loads `chat /listconversations` into ChatContext.
 * Mounted under SessionsProvider so we can keep an active booked chat room row
 * if it is not yet returned by the server list.
 */
export function InboxServerSync() {
	const { state: authState } = useAuth();
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const { state: sessionsState } = useSessions();
	const { applyInboxServerSync, setInboxFetchState } = useChat();

	const lastFetchKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const uid = authState.user?.id;
		if (!uid || !wsConnected || !wsAuthReady) {
			setInboxFetchState({ status: 'idle', error: null });
			return;
		}

		const activeChatRoomId =
			sessionsState.active?.accepted?.kind === 'chat' ?
				sessionsState.active.accepted.room_id :
				sessionsState.active?.accepted?.kind === 'call' ?
					null :
					(sessionsState.timer?.room_id ?? null);

		const key = `inbox:${uid}:${activeChatRoomId ?? ''}`;
		if (lastFetchKeyRef.current === key) return;
		lastFetchKeyRef.current = key;

		setInboxFetchState({ status: 'loading', error: null });

		const mapBody = (body: ListConversationsResponse) => {
			const selfName = authState.user?.name ?? 'You';
			const selfAvatar = authState.user?.avatar ?? '';
			const rows = (body.conversations ?? []).map(row =>
				mapConversationRowToConversation(uid, selfName, selfAvatar, row)
			);
			const serverIds: Record<string, true> = {};
			for (const r of rows) {
				serverIds[r.id] = true;
			}
			const keep: string[] = [];
			if (activeChatRoomId && !serverIds[activeChatRoomId]) {
				keep.push(activeChatRoomId);
			}
			applyInboxServerSync(rows, {
				keepConversationIds: keep,
				nextCursor: body.nextCursor ?? null,
			});
		};

		void chatListConversations(ws, ensureWsAuth, 30)
			.then(mapBody)
			.catch(() =>
				creatorsApi.chat.listConversations({ limit: 30 })
					.then(mapBody)
					.catch(e => {
						lastFetchKeyRef.current = null;
						setInboxFetchState({
							status: 'error',
							error: e instanceof Error ? e.message : String(e),
						});
					})
			);
	}, [
		authState.user?.id,
		authState.user?.name,
		authState.user?.avatar,
		ws,
		wsConnected,
		wsAuthReady,
		ensureWsAuth,
		sessionsState.active?.accepted?.kind,
		sessionsState.active?.accepted?.room_id,
		sessionsState.timer?.room_id,
		applyInboxServerSync,
		setInboxFetchState,
	]);

	return null;
}
