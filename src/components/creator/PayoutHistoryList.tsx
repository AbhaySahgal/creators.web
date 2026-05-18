import { Loader2 } from '../icons';
import { Button } from '../ui/Button';
import { formatINRFromMinor } from '../../utils/money';
import { formatDate, formatDistanceToNow } from '../../utils/date';
import type { PayoutWithdrawalRow } from '../../services/payoutTypes';

function statusStyles(status: string): string {
	const s = status.toLowerCase();
	if (s === 'completed' || s === 'paid') {
		return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
	}
	if (s === 'failed' || s === 'rejected') {
		return 'bg-rose-500/15 text-rose-400 border-rose-500/25';
	}
	return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
}

interface PayoutHistoryListProps {
	withdrawals: PayoutWithdrawalRow[];
	loading?: boolean;
	loadingMore?: boolean;
	error?: string | null;
	hasMore?: boolean;
	onRetry?: () => void;
	onLoadMore?: () => void;
}

export function PayoutHistoryList({
	withdrawals,
	loading = false,
	loadingMore = false,
	error = null,
	hasMore = false,
	onRetry,
	onLoadMore,
}: PayoutHistoryListProps) {
	return (
		<section className="bg-surface border border-border/20 rounded-2xl p-5">
			<h3 className="font-semibold text-foreground mb-4">Withdrawal history</h3>

			{error && (
				<div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
					<p className="text-xs text-rose-200">{error}</p>
					{onRetry && (
						<button
							type="button"
							onClick={onRetry}
							className="shrink-0 text-xs font-semibold text-rose-100 hover:text-white"
						>
							Retry
						</button>
					)}
				</div>
			)}

			{loading && withdrawals.length === 0 && (
				<div className="space-y-2">
					{[0, 1, 2].map(i => (
						<div key={i} className="h-14 rounded-xl bg-foreground/5 animate-pulse" />
					))}
				</div>
			)}

			{!loading && withdrawals.length === 0 && !error && (
				<p className="py-8 text-center text-sm text-muted">No withdrawals yet</p>
			)}

			{withdrawals.length > 0 && (
				<ul className="divide-y divide-border/10">
					{withdrawals.map(w => (
						<li key={w.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold text-foreground tabular-nums">
									{formatINRFromMinor(w.amountCents)}
								</p>
								<p className="text-xs text-muted mt-0.5">
									{w.createdAt ?
										<>{formatDate(w.createdAt)} · {formatDistanceToNow(w.createdAt)}</> :
										'—'}
								</p>
							</div>
							<span
								className={
									'shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
									statusStyles(w.status)
								}
							>
								{w.status}
							</span>
						</li>
					))}
				</ul>
			)}

			{hasMore && onLoadMore && (
				<div className="mt-4 flex justify-center">
					<Button
						variant="secondary"
						size="sm"
						disabled={loadingMore}
						onClick={onLoadMore}
						leftIcon={loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
					>
						{loadingMore ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			)}
		</section>
	);
}
