import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from '../icons';
import { NotificationRow } from '../notifications/NotificationRow';
import type { Notification } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { resolveNotificationTarget } from '../../services/notificationWsService';

interface NotificationPanelProps {
	onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
	const { state: authState } = useAuth();
	const {
		state: notifState,
		getUserNotifications,
		markRead,
		markAllRead,
		dismiss,
		dismissAll,
		loadMore,
		refresh,
	} = useNotifications();
	const navigate = useNavigate();
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [includeDeleted, setIncludeDeleted] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [clearBusy, setClearBusy] = useState(false);

	const userId = authState.user?.id ?? '';
	const notifications = getUserNotifications(userId).slice(0, 30);

	const reload = useCallback(() => {
		void refresh({ unreadOnly: unreadOnly || undefined, includeDeleted: includeDeleted || undefined });
	}, [refresh, unreadOnly, includeDeleted]);

	function handleRowClick(notification: Notification) {
		markRead(notification.id);
		onClose();
		const target = resolveNotificationTarget(notification);
		if (!target) return;
		if (target.state) {
			void navigate(target.path, { state: target.state });
		} else {
			void navigate(target.path);
		}
	}

	function handleDismiss(e: React.MouseEvent, id: string) {
		e.preventDefault();
		e.stopPropagation();
		if (busyId) return;
		setBusyId(id);
		void dismiss(id).finally(() => setBusyId(null));
	}

	function handleClearAll() {
		if (clearBusy) return;
		setClearBusy(true);
		void dismissAll().finally(() => setClearBusy(false));
	}

	function goToAll() {
		onClose();
		void navigate('/notifications');
	}

	return (
		<div className="absolute right-0 top-full mt-2 w-80 bg-surface2 border border-border/20 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[min(24rem,70vh)]">
			<div className="flex flex-col gap-2 px-4 py-3 border-b border-border/10 shrink-0">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<Bell className="w-4 h-4 text-muted shrink-0" />
						<span className="text-sm font-semibold text-foreground truncate">Notifications</span>
					</div>
					<div className="flex items-center gap-1 shrink-0">
						<button
							type="button"
							onClick={markAllRead}
							className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-1.5 py-1 rounded-lg"
							title="Mark all as read"
						>
							<CheckCheck className="w-3.5 h-3.5" />
							Read all
						</button>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-[11px]">
					<button
						type="button"
						onClick={() => {
							const next = !unreadOnly;
							setUnreadOnly(next);
							void refresh({ unreadOnly: next || undefined, includeDeleted: includeDeleted || undefined });
						}}
						className={`rounded-lg px-2 py-1 font-medium ${unreadOnly ? 'bg-rose-500/20 text-rose-300' : 'bg-foreground/5 text-muted hover:text-foreground'}`}
					>
						Unread only
					</button>
					<button
						type="button"
						onClick={() => {
							const next = !includeDeleted;
							setIncludeDeleted(next);
							void refresh({ unreadOnly: unreadOnly || undefined, includeDeleted: next || undefined });
						}}
						className={`rounded-lg px-2 py-1 font-medium ${includeDeleted ? 'bg-foreground/15 text-foreground' : 'bg-foreground/5 text-muted hover:text-foreground'}`}
					>
						Show dismissed
					</button>
					<button
						type="button"
						onClick={() => { void reload(); }}
						className="rounded-lg px-2 py-1 font-medium bg-foreground/5 text-muted hover:text-foreground"
					>
						Reload
					</button>
					<button
						type="button"
						onClick={() => { handleClearAll(); }}
						disabled={clearBusy}
						className="rounded-lg px-2 py-1 font-medium text-amber-400/90 hover:text-amber-300 disabled:opacity-50"
						title="Remove all notifications from this list"
					>
						{clearBusy ? 'Clearing…' : 'Clear all'}
					</button>
				</div>
				{notifState.status === 'error' && notifState.error ? (
					<p className="text-xs text-red-400/90">{notifState.error}</p>
				) : null}
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto">
				{notifState.status === 'loading' && notifications.length === 0 ? (
					<div className="text-center py-8 text-muted text-sm">Loading…</div>
				) : notifications.length === 0 ? (
					<div className="text-center py-8 text-muted text-sm">No notifications</div>
				) : (
					notifications.map(n => (
						<div
							key={n.id}
							className={`flex gap-1 items-stretch ${n.deleted_at ? 'opacity-50' : ''}`}
						>
							<div className="flex-1 min-w-0">
								<NotificationRow
									notification={n}
									onClick={() => handleRowClick(n)}
								/>
							</div>
							{n.deleted_at == null ? (
								<button
									type="button"
									onClick={e => { void handleDismiss(e, n.id); }}
									disabled={busyId === n.id}
									className="shrink-0 self-start mt-3 mr-2 p-2 rounded-lg text-muted hover:text-rose-400 hover:bg-foreground/5 disabled:opacity-40"
									title="Dismiss"
									aria-label="Dismiss notification"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							) : null}
						</div>
					))
				)}
				{notifState.nextCursor ? (
					<div className="p-3 border-t border-border/10">
						<button
							type="button"
							onClick={() => { void loadMore(); }}
							className="w-full text-xs font-semibold text-rose-400 hover:text-rose-300 py-2 rounded-xl bg-foreground/5"
						>
							Load more
						</button>
					</div>
				) : null}
			</div>

			<div className="border-t border-border/10 px-2 py-2">
				<button
					type="button"
					onClick={goToAll}
					className="w-full text-center text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 py-2 rounded-xl hover:bg-foreground/5 transition-colors"
				>
					View all
				</button>
			</div>
		</div>
	);
}
