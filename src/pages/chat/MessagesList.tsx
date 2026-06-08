import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, Plus, MoreVertical, Pin, Volume2, VolumeX } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { Avatar } from '../../components/ui/Avatar';
import { MediaAvatar } from '../../components/ui/MediaAvatar';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSessions } from '../../context/SessionsContext';
import { useWs, useWsConnected } from '../../context/WsContext';
import { useSubscribedCreatorsForFan } from '../../hooks/useSubscribedCreatorsForFan';
import { useDragScroll } from '../../hooks/useDragScroll';
import { useNotifications } from '../../context/NotificationContext';
import { formatDistanceToNow } from '../../utils/date';
import { isUuid } from '../../utils/isUuid';
import type { Conversation } from '../../types';
import { resolveInboxRowIdForMutePin } from '../../services/chatInboxService';

export function MessagesList() {
	const { state: authState } = useAuth();
	const {
		state: chatState,
		setActive,
		loadMoreInbox,
		muteInboxConversation,
		pinInboxConversation,
	} = useChat();
	const { state: sessionsState } = useSessions();
	const { subscribedCreators } = useSubscribedCreatorsForFan({ eagerHydrate: false });
	const { showToast } = useNotifications();
	const newChatStripRef = useDragScroll();
	const ws = useWs();
	const wsConnected = useWsConnected();
	const navigate = useNavigate();
	const [search, setSearch] = useState('');
	const [showNewChat, setShowNewChat] = useState(false);
	const [inboxBusy, setInboxBusy] = useState(false);
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

	useEffect(() => {
		if (!menuOpenId) return;
		const onPointerDown = (e: PointerEvent) => {
			const el = e.target as HTMLElement | null;
			if (!el) return;
			if (el.closest(`[data-inbox-menu-root="${menuOpenId}"]`)) return;
			setMenuOpenId(null);
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	}, [menuOpenId]);

	const userId = authState.user?.id ?? '';
	const isFan = authState.user?.role === 'fan';

	useEffect(() => {
		setActive(null);
	}, [setActive]);

	const activeChatRoomId =
		sessionsState.active?.accepted.kind === 'chat' ?
			sessionsState.active.accepted.room_id :
			sessionsState.active?.accepted.kind === 'call' ?
				null :
				(sessionsState.timer?.room_id ?? null);
	const hasChatRowAlready =
		!!activeChatRoomId &&
		chatState.conversations.some(c => c.id === activeChatRoomId && c.participantIds.includes(userId));

	function resumeActiveSession() {
		if (!activeChatRoomId) return;
		void navigate(`/messages/${activeChatRoomId}`);
	}

	const conversations = chatState.conversations.filter(c => {
		if (!c.participantIds.includes(userId)) return false;
		if (!search) return true;
		return c.participantNames.some(n => n.toLowerCase().includes(search.toLowerCase()));
	});

	const joinedRoomsRef = useRef<Record<string, true>>({});
	useEffect(() => {
		if (!wsConnected) return;
		const rooms = conversations.map(c => c.id).filter(id => isUuid(id));
		for (const rid of rooms) {
			if (sessionsState.endedRooms?.[rid]) continue;
			if (joinedRoomsRef.current[rid]) continue;
			joinedRoomsRef.current[rid] = true;
			void ws.request('chat', 'joinroom', [rid]).catch(() => {});
		}
	}, [conversations, sessionsState.endedRooms, ws, wsConnected]);

	function getOtherParticipant(conv: Conversation) {
		const idx = conv.participantIds.indexOf(userId);
		if (idx === -1) {
			const fallback = conv.participantNames[1] ?? conv.participantNames[0] ?? 'User';
			const fallbackAvatar = conv.participantAvatars[1] ?? conv.participantAvatars[0] ?? '';
			const fallbackId = conv.participantIds[1] ?? conv.participantIds[0] ?? '';
			return { name: fallback, avatar: fallbackAvatar, id: fallbackId };
		}
		const otherIdx = idx === 0 ? 1 : 0;
		return {
			name: conv.participantNames[otherIdx] ?? 'User',
			avatar: conv.participantAvatars[otherIdx] ?? '',
			id: conv.participantIds[otherIdx] ?? '',
		};
	}

	function startNewChat(creatorId: string, creatorName: string, creatorAvatar: string, isOnline: boolean) {
		const existing = chatState.conversations.find(c =>
			c.participantIds.includes(userId) && c.participantIds.includes(creatorId)
		);
		if (existing) {
			void navigate(`/messages/${existing.id}`);
			setShowNewChat(false);
			return;
		}
		void creatorName;
		void creatorAvatar;
		void isOnline;
		showToast('Messaging from here is coming soon.', 'info');
	}

	return (
		<Layout>
			<div className="max-w-2xl mx-auto px-4 py-6">
				<div className="flex items-center justify-between mb-5">
					<h1 className="text-xl font-bold text-foreground">Messages</h1>
					{isFan && (
						<button
							type="button"
							onClick={() => setShowNewChat(v => !v)}
							className="w-9 h-9 bg-rose-500 hover:bg-rose-600 rounded-xl flex items-center justify-center transition-colors"
							aria-label="New message"
						>
							<Plus className="w-5 h-5 text-white" />
						</button>
					)}
				</div>

				{isFan && showNewChat && (
					<div className="bg-surface border border-border/20 rounded-2xl p-4 mb-4">
						<p className="text-xs text-muted font-medium mb-3 uppercase tracking-wider">Subscribed</p>
						{subscribedCreators.length === 0 ? (
							<p className="text-muted text-sm">Subscribe to creators to message them</p>
						) : (
							<div ref={newChatStripRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
								{subscribedCreators.map(creator => (
									<button
										key={creator.id}
										type="button"
										onClick={() => startNewChat(creator.id, creator.name, creator.avatar, creator.isOnline)}
										className="flex flex-col items-center gap-1 shrink-0"
									>
										<div className="relative">
											<div className={`w-14 h-14 rounded-full p-0.5 ${creator.isOnline ? 'bg-gradient-to-tr from-rose-500 to-amber-400' : 'bg-foreground/10'}`}>
												<MediaAvatar
													src={creator.avatar}
													alt={creator.name}
													name={creator.name}
													className="h-full w-full rounded-full border-2 border-background"
												/>
											</div>
											{creator.isOnline && (
												<div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-background rounded-full" />
											)}
										</div>
										<p className="text-[10px] text-muted w-14 text-center truncate">{creator.name.split(' ')[0]}</p>
									</button>
								))}
							</div>
						)}
					</div>
				)}

				<div className="relative mb-4">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
					<input
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder="Search conversations..."
						className="w-full bg-input border border-border/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40"
					/>
				</div>

				{chatState.inboxStatus === 'error' && chatState.inboxError && (
					<p className="text-xs text-rose-400 mb-2">{chatState.inboxError}</p>
				)}

				{activeChatRoomId && !hasChatRowAlready && sessionsState.ended?.room_id !== activeChatRoomId && (
					<button
						type="button"
						onClick={() => resumeActiveSession()}
						className="w-full mb-3 flex items-center gap-3 p-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15 transition-colors text-left"
					>
						<div className="w-11 h-11 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0">
							<MessageCircle className="w-5 h-5 text-rose-300" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-semibold text-foreground truncate">Resume chat session</p>
							<p className="text-xs text-muted/80 truncate">
								Your booked session is active. Tap to re-join the room.
							</p>
						</div>
						<span className="text-xs font-semibold text-rose-300 shrink-0">Open</span>
					</button>
				)}

				{chatState.inboxStatus === 'loading' && conversations.length === 0 ? (
					<div className="text-center py-16 text-muted text-sm">Loading conversations…</div>
				) : conversations.length === 0 ? (
					<div className="text-center py-16">
						<div className="w-14 h-14 bg-foreground/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
							<MessageCircle className="w-6 h-6 text-muted/60" />
						</div>
						<p className="text-muted font-medium mb-1">No conversations yet</p>
						<p className="text-sm text-muted/80">Book a chat session to appear here</p>
					</div>
				) : (
					<div className="space-y-1">
						{conversations.map(conv => {
							const other = getOtherParticipant(conv);
							const canMutePin = Boolean(resolveInboxRowIdForMutePin(conv));
							return (
								<div
									key={conv.id}
									className="flex items-stretch gap-0 w-full group"
								>
									<button
										type="button"
										onClick={() => {
											setMenuOpenId(null);
											void navigate(`/messages/${conv.id}`);
										}}
										className="flex-1 min-w-0 flex items-center gap-3 p-3 hover:bg-foreground/5 rounded-2xl transition-colors text-left"
									>
										<Avatar src={other.avatar} alt={other.name} size="lg" isOnline={conv.isOnline} />
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between mb-0.5 gap-1">
												<p className={`text-sm font-semibold truncate flex items-center gap-1.5 ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
													{conv.pinned && (
														<Pin className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden />
													)}
													{conv.muted && (
														<VolumeX className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden />
													)}
													<span className="truncate">{other.name}</span>
												</p>
												<p className="text-xs text-muted/80 shrink-0">
													{formatDistanceToNow(conv.lastMessageTime)}
												</p>
											</div>
											<div className="flex items-center justify-between gap-1">
												<p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-foreground/70' : 'text-muted/80'}`}>
													{conv.lastMessage || 'No messages yet'}
												</p>
												{conv.unreadCount > 0 && (
													<span className="bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
														{conv.unreadCount}
													</span>
												)}
											</div>
										</div>
									</button>
									<div
										className="relative shrink-0 flex items-center pr-1"
										data-inbox-menu-root={conv.id}
									>
										<button
											type="button"
											className="p-2.5 rounded-xl text-muted hover:text-foreground hover:bg-foreground/5 opacity-80 group-hover:opacity-100 transition-opacity"
											aria-label="Chat options"
											aria-expanded={menuOpenId === conv.id}
											onClick={e => {
												e.preventDefault();
												e.stopPropagation();
												setMenuOpenId(v => (v === conv.id ? null : conv.id));
											}}
										>
											<MoreVertical className="w-5 h-5" />
										</button>
										{menuOpenId === conv.id ? (
											<div
												role="menu"
												className="absolute right-0 top-[calc(100%-4px)] z-30 min-w-[11rem] py-1 rounded-xl border border-border/30 bg-surface shadow-lg"
											>
												<button
													type="button"
													role="menuitem"
													disabled={!canMutePin}
													title={!canMutePin ? 'Pin is only available once this thread is synced from the inbox server.' : undefined}
													className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-foreground hover:bg-foreground/5 disabled:opacity-40 disabled:pointer-events-none"
													onClick={e => {
														e.stopPropagation();
														setMenuOpenId(null);
														void pinInboxConversation(conv, !conv.pinned).catch(err => {
															showToast(err instanceof Error ? err.message : 'Could not pin', 'error');
														});
													}}
												>
													<Pin className="w-4 h-4 shrink-0 text-muted" />
													{conv.pinned ? 'Unpin chat' : 'Pin chat'}
												</button>
												<button
													type="button"
													role="menuitem"
													disabled={!canMutePin}
													title={!canMutePin ? 'Mute is only available once this thread is synced from the inbox server.' : undefined}
													className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-foreground hover:bg-foreground/5 disabled:opacity-40 disabled:pointer-events-none"
													onClick={e => {
														e.stopPropagation();
														setMenuOpenId(null);
														void muteInboxConversation(conv, !conv.muted).catch(err => {
															showToast(err instanceof Error ? err.message : 'Could not mute', 'error');
														});
													}}
												>
													{conv.muted ?
														<Volume2 className="w-4 h-4 shrink-0 text-muted" /> :
														<VolumeX className="w-4 h-4 shrink-0 text-muted" />}
													{conv.muted ? 'Unmute notifications' : 'Mute notifications'}
												</button>
											</div>
										) : null}
									</div>
								</div>
							);
						})}
						{chatState.inboxNextCursor ? (
							<div className="pt-3 flex justify-center">
								<button
									type="button"
									disabled={inboxBusy}
									onClick={() => {
										setInboxBusy(true);
										void loadMoreInbox().finally(() => setInboxBusy(false));
									}}
									className="text-sm font-medium text-rose-400 hover:text-rose-300 disabled:opacity-50"
								>
									{inboxBusy ? 'Loading…' : 'Load more'}
								</button>
							</div>
						) : null}
					</div>
				)}
			</div>
		</Layout>
	);
}
