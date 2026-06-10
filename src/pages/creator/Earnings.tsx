import { useState } from 'react';
import { DollarSign, TrendingUp, Zap, Users, ArrowUpRight } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { PayoutBalanceCards } from '../../components/creator/PayoutBalanceCards';
import { PayoutHistoryList } from '../../components/creator/PayoutHistoryList';
import { PayoutKycBanner } from '../../components/creator/PayoutKycBanner';
import { WithdrawPayoutModal } from '../../components/creator/WithdrawPayoutModal';
import { useAuth, useCurrentCreator } from '../../context/AuthContext';
import { usePayouts } from '../../hooks/usePayouts';
import { mockCreators } from '../../data/users';
import { useNotifications } from '../../context/NotificationContext';
import { formatINR } from '../../services/razorpay';
import { earningsPageMonthlyRupeeRows, parseMinorStringToRupees } from '../../utils/creatorDashboardMonthlyStats';
import { compareMinor } from '../../utils/money';

function parseMinorToRupees(minor: string | number | null | undefined): number {
	return parseMinorStringToRupees(minor);
}

export function Earnings() {
	const creator = useCurrentCreator();
	const { state: authState } = useAuth();
	const { showToast } = useNotifications();
	const [showWithdraw, setShowWithdraw] = useState(false);

	const creatorData = creator ?? mockCreators[0];
	const dashboard = authState.user?.creatorDashboard;
	const fallbackKyc = dashboard?.kycStatus ?? creatorData.kycStatus;

	const {
		balance,
		balanceLoading,
		balanceError,
		reloadBalance,
		withdrawals,
		historyLoading,
		historyLoadingMore,
		historyError,
		hasMoreHistory,
		loadMoreHistory,
		reloadHistory,
		withdrawing,
		requestWithdraw,
		canWithdraw,
		kycStatus,
	} = usePayouts(fallbackKyc);

	const totalEarnings = dashboard ? parseMinorToRupees(dashboard.totalEarningsCents) : creatorData.totalEarnings;
	const monthlyEarnings = dashboard ? parseMinorToRupees(dashboard.monthlyEarningsCents) : creatorData.monthlyEarnings;
	const tipsReceived = dashboard ? parseMinorToRupees(dashboard.tipsReceivedCents) : creatorData.tipsReceived;
	const subscriberCount = dashboard?.subscriberCount ?? creatorData.subscriberCount;
	const monthlyStats = earningsPageMonthlyRupeeRows(dashboard, creatorData.monthlyStats);
	const monthlyBarMax = Math.max(1, ...monthlyStats.map(s => s.earnings));
	const bySource = dashboard?.earningsBySource;
	const sourceSubscriptions = bySource ? parseMinorToRupees(bySource.subscriptionsCents) : Math.max(0, monthlyEarnings - tipsReceived);
	const sourceTips = bySource ? parseMinorToRupees(bySource.tipsCents) : tipsReceived;
	const sourceSessions = bySource ? parseMinorToRupees(bySource.sessionsCents) : 0;
	const revenueSourcesTotal = sourceSubscriptions + sourceTips + sourceSessions;

	const availableMinor = balance?.availableCents ?? '0';
	const withdrawDisabled =
		!canWithdraw ||
		balanceLoading ||
		compareMinor(availableMinor, '<=', '0');

	function handleWithdraw(amountCents: string) {
		return requestWithdraw(amountCents).then(result => {
			showToast('Withdrawal requested — processing', 'success');
			return result;
		});
	}

	return (
		<Layout>
			<div className="max-w-4xl mx-auto px-4 py-6">
				<div className="flex items-center justify-between mb-2">
					<div>
						<h1 className="text-xl font-bold text-foreground">Earnings</h1>
						<p className="text-sm text-muted">Analytics and payouts</p>
					</div>
					<Button
						variant="primary"
						onClick={() => setShowWithdraw(true)}
						leftIcon={<ArrowUpRight className="w-4 h-4" />}
						size="sm"
						disabled={withdrawDisabled}
					>
						Withdraw
					</Button>
				</div>

				<section className="mb-6">
					<h2 className="text-base font-bold text-foreground mb-3">Payouts</h2>
					{balanceError && (
						<div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
							<p className="text-xs text-rose-200">{balanceError}</p>
							<button
								type="button"
								onClick={() => { void reloadBalance(); }}
								className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100"
							>
								Retry
							</button>
						</div>
					)}
					<PayoutKycBanner kycStatus={kycStatus} />
					<PayoutBalanceCards balance={balance} loading={balanceLoading} />
				</section>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					{[
						{ label: 'Total Earnings', value: formatINR(totalEarnings), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
						{ label: 'This Month', value: formatINR(monthlyEarnings), icon: TrendingUp, color: 'text-rose-400', bg: 'bg-rose-500/15' },
						{ label: 'Tips Received', value: formatINR(sourceTips), icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/15' },
						{ label: 'Subscribers', value: subscriberCount.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/15' },
					].map(({ label, value, icon: Icon, color, bg }) => (
						<div key={label} className="bg-surface border border-border/20 rounded-2xl p-4">
							<div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-2`}>
								<Icon className={`w-4 h-4 ${color}`} />
							</div>
							<p className="text-xl font-black text-foreground">{value}</p>
							<p className="text-xs text-muted">{label}</p>
						</div>
					))}
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-5 mb-4">
					<h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
						<TrendingUp className="w-4 h-4 text-rose-400" />
						Monthly Breakdown
					</h3>
					<div className="space-y-3">
						{monthlyStats.map((stat, i) => {
							const pct = (stat.earnings / monthlyBarMax) * 100;
							return (
								<div key={i} className="flex items-center gap-3">
									<p className="text-xs text-muted w-8 shrink-0">{stat.month}</p>
									<div className="flex-1 h-6 bg-foreground/10 rounded-full overflow-hidden">
										<div
											className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
											style={{ width: `${pct}%` }}
										>
											{pct > 30 && <span className="text-[10px] font-bold text-white">{formatINR(stat.earnings)}</span>}
										</div>
									</div>
									<p className="text-xs font-semibold text-foreground/80 w-16 text-right shrink-0">{formatINR(stat.earnings)}</p>
								</div>
							);
						})}
					</div>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-5 mb-4">
					<h3 className="font-semibold text-foreground mb-4">Revenue Sources</h3>
					<div className="space-y-3">
						{[
							{ label: 'Subscriptions', value: sourceSubscriptions, color: 'bg-rose-500' },
							{ label: 'Tips', value: sourceTips, color: 'bg-amber-500' },
							{ label: 'Sessions', value: sourceSessions, color: 'bg-blue-500' },
						].map(({ label, value, color }) => {
							const widthPct = revenueSourcesTotal > 0 ?
								Math.min(100, (value / revenueSourcesTotal) * 100) :
								0;
							return (
								<div key={label} className="flex items-center gap-3 min-w-0">
									<div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
									<p className="w-[7.25rem] shrink-0 text-sm text-muted sm:w-32">{label}</p>
									<div className="min-w-0 flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
										<div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${widthPct}%` }} />
									</div>
									<p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground/80 sm:w-28">{formatINR(value)}</p>
								</div>
							);
						})}
					</div>
				</div>

				<PayoutHistoryList
					withdrawals={withdrawals}
					loading={historyLoading}
					loadingMore={historyLoadingMore}
					error={historyError}
					hasMore={hasMoreHistory}
					onRetry={() => { void reloadHistory(); }}
					onLoadMore={() => { void loadMoreHistory(); }}
				/>
			</div>

			<WithdrawPayoutModal
				isOpen={showWithdraw}
				onClose={() => setShowWithdraw(false)}
				balance={balance}
				withdrawing={withdrawing}
				canWithdraw={canWithdraw}
				onWithdraw={handleWithdraw}
			/>
		</Layout>
	);
}
