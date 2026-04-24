import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useSessionsWs } from '../../context/SessionsWsContext';
import { MessageCircle, Clock } from '../icons';

export function IncomingSessionRequestOverlay() {
	const navigate = useNavigate();
	const { state: authState } = useAuth();
	const { incomingRequests, acceptRequest } = useSessionsWs();
	const { showToast } = useNotifications();

	const isCreator = authState.user?.role === 'creator';

	const top = useMemo(() => incomingRequests[0] ?? null, [incomingRequests]);
	if (!isCreator || !top) return null;

	async function handleAccept() {
		try {
			const resp = await acceptRequest(top.request_id);
			showToast('Session accepted. Joining room…', 'success');
			void navigate(`/session/chat/${resp.request_id}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to accept session';
			showToast(msg, 'error');
		}
	}

	return (
		<div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[250] w-[92vw] max-w-sm">
			<div className="bg-[#141414] border border-white/10 rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
				<div className="p-4">
					<div className="flex items-start gap-3">
						<div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
							<MessageCircle className="w-5 h-5 text-emerald-400" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-semibold text-white">Incoming chat booking</p>
							<p className="text-xs text-white/40 truncate">
								{top.fan_display ? `${top.fan_display} requested a timed chat` : `Fan ${top.fan_user_id} requested a timed chat`}
							</p>
							<div className="flex items-center gap-2 mt-2 text-[11px] text-white/30">
								<div className="flex items-center gap-1">
									<Clock className="w-3.5 h-3.5" />
									<span>{top.minutes ?? '?'}m</span>
								</div>
								{typeof top.price_cents === 'number' && (
									<span>· ${(top.price_cents / 100).toFixed(2)}</span>
								)}
							</div>
						</div>
					</div>

					<div className="mt-4 flex gap-2">
						<button
							onClick={handleAccept}
							className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all"
						>
							Accept
						</button>
						<button
							onClick={() => showToast('Ignoring request (no decline command in spec).', 'info')}
							className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-white/50 text-sm font-semibold transition-all"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

