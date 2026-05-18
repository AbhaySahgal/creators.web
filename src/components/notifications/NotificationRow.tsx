import type { Notification } from '../../types';
import { Bell, Heart } from '../icons';
import { formatDistanceToNow } from '../../utils/date';
import { formatINRFromMinor } from '../../utils/money';
import {
	isCommentHeartedData,
	isNotificationDeleted,
	parseCommentHeartedData,
} from '../../services/notificationWsService';

/** Tip payloads use `amount_cents` (minor string) per API; values are INR paise in this product. */
export function tipMinorFromNotificationData(data: Record<string, unknown>): string | null {
	for (const key of ['amount_cents', 'amount_minor', 'price_minor'] as const) {
		const v = data[key];
		if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return String(Math.round(v));
		if (typeof v === 'string' && /^\d+$/.test(v.trim())) return v.trim();
	}
	return null;
}

interface NotificationRowProps {
	notification: Notification;
	onClick: () => void;
}

export function NotificationRow({ notification: n, onClick }: NotificationRowProps) {
	const data = n.data ?? {};
	const isDeleted = isNotificationDeleted(data);
	const isCommentHearted = isCommentHeartedData(data);
	const hearted = isCommentHearted ? parseCommentHeartedData(data) : null;

	const fromAvatar =
		hearted?.actor_avatar_url ??
		(typeof data.actor_avatar_url === 'string' ? data.actor_avatar_url : undefined) ??
		(typeof data.from_avatar === 'string' ? data.from_avatar : undefined) ??
		(typeof data.fromAvatar === 'string' ? data.fromAvatar : undefined);

	const isRead = n.read_at != null;
	const kind = typeof data.kind === 'string' ? data.kind : '';
	const tipMinor = kind === 'tip' ? tipMinorFromNotificationData(data) : null;
	const tipSubtitle =
		tipMinor != null ?
			<span className="text-amber-500 dark:text-amber-400/90">Tip · {formatINRFromMinor(tipMinor)}</span> :
			null;

	const heartSubtitle =
		isCommentHearted && !tipSubtitle ?
			<span className="text-rose-500 dark:text-rose-400/90 inline-flex items-center gap-1">
				<Heart className="w-3 h-3 shrink-0 fill-current" aria-hidden />
				{hearted?.actor_display_name ?
					<span>{hearted.actor_display_name} liked your comment</span> :
					<span>Liked your comment</span>}
			</span> :
			null;

	const tipBody = kind === 'tip' && tipMinor != null ? '' : (n.body ?? '');
	const showBody = tipBody && !heartSubtitle;

	return (
		<button
			type="button"
			onClick={isDeleted ? undefined : onClick}
			disabled={isDeleted}
			className={
				'w-full flex gap-3 px-4 py-3 transition-colors text-left ' +
				'border-b border-border/10 last:border-0 ' +
				(isDeleted ?
					'opacity-50 cursor-default' :
					'hover:bg-foreground/5') +
					(!isRead && !isDeleted ? ' bg-rose-500/5' : '')
			}
			aria-disabled={isDeleted || undefined}
		>
			{fromAvatar ? (
				<img src={fromAvatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
			) : (
				<div
					className={
						'w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' +
						(isCommentHearted ? 'bg-rose-500/15' : 'bg-foreground/10')
					}
				>
					{isCommentHearted ?
						<Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" aria-hidden /> :
						<Bell className="w-4 h-4 text-muted" />}
				</div>
			)}
			<div className="flex-1 min-w-0">
				<p className={`text-xs font-medium truncate ${isRead || isDeleted ? 'text-muted' : 'text-foreground'}`}>
					{n.title}
				</p>
				{tipSubtitle ? <p className="text-[11px] truncate mt-0.5 text-foreground/90">{tipSubtitle}</p> : null}
				{heartSubtitle ? <p className="text-[11px] truncate mt-0.5 text-foreground/90">{heartSubtitle}</p> : null}
				{showBody ? <p className="text-xs text-muted truncate mt-0.5">{tipBody}</p> : null}
				{isDeleted ? (
					<p className="text-[10px] text-muted/70 mt-1">No longer available</p>
				) : (
					<p className="text-[10px] text-muted/80 mt-1">{formatDistanceToNow(n.created_at)}</p>
				)}
			</div>
			{!isRead && !isDeleted && <div className="w-2 h-2 bg-rose-500 rounded-full mt-1 shrink-0" aria-hidden />}
		</button>
	);
}
