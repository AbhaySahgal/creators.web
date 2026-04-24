import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Clock, AlertTriangle, MessageCircle } from '../../components/icons';
import { useAuth } from '../../context/AuthContext';
import { mockCreators } from '../../data/users';
import { Avatar } from '../../components/ui/Avatar';
import { useSessionsWs } from '../../context/SessionsWsContext';
import type { ChatMessage } from '../../services/ws/chatWs';
import { SessionFeedbackModal } from '../../components/modals/SessionFeedbackModal';
import { useNotifications } from '../../context/NotificationContext';

interface ChatMsg {
	id: string;
	senderId: string;
	senderName: string;
	senderAvatar: string;
	text: string;
	createdAt: string;
}

function formatTime(secs: number): string {
	const m = Math.floor(secs / 60).toString().padStart(2, '0');
	const s = (secs % 60).toString().padStart(2, '0');
	return `${m}:${s}`;
}

function toChatMsg(msg: ChatMessage): ChatMsg | null {
	const createdAt = msg.created_at ?? msg.createdAt ?? new Date().toISOString();
	const text = msg.text ?? msg.content;
	if (!msg.id || !msg.room_id || !text) return null;
	return {
		id: msg.id,
		senderId: msg.user_id ?? 'unknown',
		senderName: msg.user_name ?? 'User',
		senderAvatar: msg.user_avatar ?? '',
		text,
		createdAt,
	};
}

export function TimedChatRoom() {
	const { requestId } = useParams<{ requestId: string }>();
	const navigate = useNavigate();
	const { state: authState } = useAuth();
	const { activeBooking, joinRoom, sendRoomMessage, onRoomMessage, complete } = useSessionsWs();
	const { submitFeedback } = useSessionsWs();
	const { showToast } = useNotifications();
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [text, setText] = useState('');
	const [secondsRemaining, setSecondsRemaining] = useState(0);
	const [showFeedback, setShowFeedback] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const booking = activeBooking && requestId && activeBooking.request_id === requestId ? activeBooking : null;
	const creator = useMemo(() => mockCreators.find(c => c.id === booking?.creator_user_id), [booking?.creator_user_id]);

	useEffect(() => {
		if (!requestId) {
			navigate(-1);
		}
	}, [requestId, navigate]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		if (!booking?.ends_at) return;
		const tick = () => {
			const endMs = new Date(booking.ends_at!).getTime();
			const remain = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
			setSecondsRemaining(remain);
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [booking?.ends_at]);

	useEffect(() => {
		if (!booking?.room_id) return;
		void joinRoom(booking.room_id).catch(() => {
			// errors surface via toast in higher layer
		});
		const unsub = onRoomMessage(booking.room_id, msg => {
			const mapped = toChatMsg(msg);
			if (!mapped) return;
			setMessages(prev => {
				if (prev.some(m => m.id === mapped.id)) return prev;
				return [...prev, mapped];
			});
		});
		return () => unsub();
	}, [booking?.room_id, joinRoom, onRoomMessage]);

	useEffect(() => {
		if (!booking) return;
		if (booking.status !== 'ended') return;
		setMessages(prev => (
			prev.some(m => m.id.startsWith('end-')) ? prev : [
				...prev,
				{
					id: `end-${Date.now()}`,
					senderId: 'system',
					senderName: 'System',
					senderAvatar: '',
					text: booking.reason === 'timeout' ? 'Session ended (time is up).' : 'Session ended.',
					createdAt: new Date().toISOString(),
				},
			]
		));
	}, [booking?.status, booking?.reason]);

	useEffect(() => {
		if (!booking) return;
		if (booking.feedbackPrompted) setShowFeedback(true);
	}, [booking?.feedbackPrompted]);

	function handleSend(e: React.FormEvent) {
		e.preventDefault();
		if (!text.trim() || !authState.user || !booking?.room_id || booking.status === 'ended') return;
		const optimistic: ChatMsg = {
			id: `tmp-${Date.now()}`,
			senderId: authState.user.id,
			senderName: authState.user.name,
			senderAvatar: authState.user.avatar,
			text: text.trim(),
			createdAt: new Date().toISOString(),
		};
		setMessages(prev => [...prev, optimistic]);
		const outgoing = text.trim();
		setText('');

		void sendRoomMessage(booking.room_id, outgoing).then(msg => {
			const mapped = toChatMsg(msg);
			if (!mapped) return;
			setMessages(prev => {
				const withoutTmp = prev.filter(m => m.id !== optimistic.id);
				if (withoutTmp.some(m => m.id === mapped.id)) return withoutTmp;
				return [...withoutTmp, mapped];
			});
		}).catch(() => {
			// keep optimistic message; error surfaced via toast from higher layer
		});
	}

	function handleEndEarly() {
		if (!booking) return;
		void complete(booking.request_id).catch(() => {
			// toast handled upstream
		});
	}

	const isWarning = secondsRemaining <= 60 && secondsRemaining > 0;
	const isExpired = !booking || booking.status === 'ended' || secondsRemaining <= 0;

	return (
		<div className="fixed inset-0 z-[100] bg-[#0d0d0d] flex flex-col">
			<div className="bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-white/5 px-4 h-14 flex items-center gap-3 shrink-0">
				<button type="button" onClick={() => { void navigate(-1); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
					<ArrowLeft className="w-5 h-5 text-white/60" />
				</button>
				<Avatar src={creator?.avatar ?? ''} alt={creator?.name ?? ''} size="sm" />
				<div className="flex-1">
					<p className="text-sm font-semibold text-white">{creator?.name ?? 'Timed Chat'}</p>
					<div className="flex items-center gap-1">
						<MessageCircle className="w-3 h-3 text-white/30" />
						<span className="text-xs text-white/30">Timed Chat</span>
					</div>
				</div>

				{booking && (
					<div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold ${
						isWarning ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-white/8 text-white'
					}`}
					>
						{isWarning && <AlertTriangle className="w-3.5 h-3.5" />}
						<Clock className="w-3.5 h-3.5" />
						{formatTime(secondsRemaining)}
					</div>
				)}
			</div>

			{booking && (
				<div className={`px-4 py-2 flex items-center justify-between shrink-0 ${isWarning ? 'bg-rose-500/10 border-b border-rose-500/20' : 'bg-amber-500/5 border-b border-amber-500/10'}`}>
					<p className="text-xs text-white/40">
						Request: {booking.request_id} · {booking.status}
					</p>
					{booking.status !== 'ended' && (
						<button
							onClick={handleEndEarly}
							className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
						>
							End Early
						</button>
					)}
				</div>
			)}

			<div className="flex-1 overflow-y-auto pb-4">
				<div className="max-w-2xl mx-auto px-4 space-y-3 py-4">
					{messages.map(msg => {
						const isMe = msg.senderId === authState.user?.id;
						const isSystem = msg.senderId === 'system';
						if (isSystem) {
							return (
								<div key={msg.id} className="flex justify-center">
									<div className={`px-4 py-2 rounded-xl text-xs font-medium ${
										msg.text.includes('⚠️') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-white/8 text-white/50'
									}`}
									>
										{msg.text}
									</div>
								</div>
							);
						}
						return (
							<div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
								{!isMe && <Avatar src={msg.senderAvatar} alt={msg.senderName} size="sm" className="mt-auto mb-1" />}
								<div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
									isMe ? 'bg-rose-500 text-white rounded-tr-sm' : 'bg-[#1e1e1e] text-white/80 rounded-tl-sm'
								}`}
								>
									{msg.text}
								</div>
							</div>
						);
					})}
					<div ref={messagesEndRef} />
				</div>
			</div>

			<div className={`border-t px-4 py-3 shrink-0 ${isExpired ? 'opacity-40 pointer-events-none' : ''} border-white/5 bg-[#0d0d0d]/95`}>
				<div className="max-w-2xl mx-auto">
					<form onSubmit={handleSend} className="flex gap-2">
						<input
							value={text}
							onChange={e => setText(e.target.value)}
							placeholder={!booking ? 'Loading…' : booking.status === 'ended' ? 'Session ended' : 'Type a message...'}
							className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-rose-500/30"
							disabled={!booking || booking.status === 'ended'}
						/>
						<button
							type="submit"
							disabled={!text.trim() || !booking || booking.status === 'ended'}
							className="w-10 h-10 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all active:scale-95"
						>
							<Send className="w-4 h-4 text-white" />
						</button>
					</form>
				</div>
			</div>

			<SessionFeedbackModal
				isOpen={showFeedback}
				onClose={() => setShowFeedback(false)}
				onSubmit={async (rating, comment) => {
					if (!booking) return;
					try {
						await submitFeedback(booking.request_id, rating, comment);
						showToast('Feedback submitted.', 'success');
					} catch (err) {
						const msg = err instanceof Error ? err.message : 'Failed to submit feedback';
						showToast(msg, 'error');
						throw err;
					}
				}}
			/>
		</div>
	);
}
