import { Clock, Wallet } from '../icons';
import { formatINRFromMinor } from '../../utils/money';
import type { PayoutBalance } from '../../services/payoutTypes';

interface PayoutBalanceCardsProps {
	balance: PayoutBalance | null;
	loading?: boolean;
}

export function PayoutBalanceCards({ balance, loading = false }: PayoutBalanceCardsProps) {
	const available = balance?.availableCents ?? '0';
	const pending = balance?.pendingCents ?? '0';
	const currency = balance?.currency ?? 'INR';

	if (loading && !balance) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
				{[0, 1].map(i => (
					<div key={i} className="h-[88px] rounded-2xl bg-foreground/5 animate-pulse border border-border/10" />
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
			<div className="bg-surface border border-border/20 rounded-2xl p-4">
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
						<Wallet className="w-4 h-4 text-emerald-400" />
					</div>
					<span className="text-[10px] font-medium uppercase tracking-wide text-muted">{currency}</span>
				</div>
				<p className="text-xl font-black text-foreground tabular-nums">{formatINRFromMinor(available)}</p>
				<p className="text-xs text-muted mt-0.5">Available to withdraw</p>
			</div>
			<div className="bg-surface border border-border/20 rounded-2xl p-4">
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
						<Clock className="w-4 h-4 text-amber-400" />
					</div>
				</div>
				<p className="text-xl font-black text-foreground tabular-nums">{formatINRFromMinor(pending)}</p>
				<p className="text-xs text-muted mt-0.5">Pending settlement</p>
				<p className="text-[10px] text-muted/80 mt-1 leading-snug">
					Withdrawals stay pending until the payout provider processes them.
				</p>
			</div>
		</div>
	);
}
