import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, DollarSign, Users, Star } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer } from '../../components/ui/Toast';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import {
	adminAnalyticsTotals,
	adminRevenueBreakdown,
	adminRevenueSeries,
	adminTopEarners,
} from '../../services/adminWs';
import type {
	AdminAnalyticsTotalsResponse,
	AdminRevenueBreakdownResponse,
	AdminRevenueSeriesResponse,
	AdminTopEarnerRow,
} from '../../services/adminWsTypes';
import { formatINRFromMinor } from '../../utils/money';
import { humanizeWsBackendError } from '../../utils/wsBackendError';

function seriesPoints(res: AdminRevenueSeriesResponse): { label: string; minor: string }[] {
	const raw = res.series ?? res.points ?? res.months ?? [];
	return raw.map((p, i) => ({
		label: String(p.month ?? p.label ?? `M${i + 1}`),
		minor: String(p.revenueMinor ?? p.amountMinor ?? '0'),
	}));
}

export function AdminAnalytics() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();

	const [totals, setTotals] = useState<AdminAnalyticsTotalsResponse | null>(null);
	const [series, setSeries] = useState<{ label: string; minor: string }[]>([]);
	const [earners, setEarners] = useState<AdminTopEarnerRow[]>([]);
	const [breakdown, setBreakdown] = useState<AdminRevenueBreakdownResponse | null>(null);
	const [earnWindow, setEarnWindow] = useState<'all_time' | 'last_30d' | 'last_90d'>('last_30d');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!wsAuthReady && wsConnected) return;
		if (!wsConnected) {
			setLoading(false);
			setError('WebSocket disconnected');
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				setLoading(true);
				setError(null);
				await ensureWsAuth();
				const [t, s, e, b] = await Promise.all([
					adminAnalyticsTotals(ws),
					adminRevenueSeries(ws, 6),
					adminTopEarners(ws, 5, earnWindow),
					adminRevenueBreakdown(ws),
				]);
				if (cancelled) return;
				setTotals(t);
				setSeries(seriesPoints(s));
				setEarners(e.items ?? []);
				setBreakdown(b);
			} catch (err) {
				if (!cancelled) setError(humanizeWsBackendError(err instanceof Error ? err.message : 'Failed to load analytics'));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [earnWindow, ensureWsAuth, ws, wsAuthReady, wsConnected]);

	const maxMinor = useMemo(() => {
		let m = 0n;
		for (const p of series) {
			const v = BigInt(/^\d+$/.test(p.minor) ? p.minor : '0');
			if (v > m) m = v;
		}
		return m || 1n;
	}, [series]);

	const breakdownRows = useMemo(() => {
		if (!breakdown) return [];
		if (breakdown.bySource && typeof breakdown.bySource === 'object') {
			return Object.entries(breakdown.bySource).map(([label, minor]) => ({ label, minor: String(minor) }));
		}
		const rows: { label: string; minor: string }[] = [];
		if (breakdown.subscriptionsMinor) rows.push({ label: 'Subscriptions', minor: breakdown.subscriptionsMinor });
		if (breakdown.tipsMinor) rows.push({ label: 'Tips', minor: breakdown.tipsMinor });
		if (breakdown.sessionsMinor) rows.push({ label: 'Sessions', minor: breakdown.sessionsMinor });
		if (breakdown.ppvMinor) rows.push({ label: 'PPV', minor: breakdown.ppvMinor });
		return rows;
	}, [breakdown]);

	const platformMinor = totals?.platformRevenueMinor;
	const platformLabel = platformMinor ? formatINRFromMinor(platformMinor) : (loading ? '…' : '—');

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
				<div className="flex items-center gap-3 mb-6">
					<TrendingUp className="w-5 h-5 text-rose-400" />
					<h1 className="text-xl font-bold text-foreground">Platform analytics</h1>
				</div>

				{error && (
					<div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
						{error}
					</div>
				)}

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					{[
						{ label: 'Platform revenue', value: platformLabel, icon: DollarSign, color: 'bg-emerald-500/15 text-emerald-400' },
						{ label: 'Active creators', value: totals?.activeCreators != null ? String(totals.activeCreators) : (loading ? '…' : '—'), icon: Star, color: 'bg-rose-500/15 text-rose-400' },
						{ label: 'Total users', value: totals?.totalUsers != null ? String(totals.totalUsers) : (loading ? '…' : '—'), icon: Users, color: 'bg-blue-500/15 text-blue-400' },
						{ label: 'Window', value: earnWindow.replace(/_/g, ' '), icon: TrendingUp, color: 'bg-amber-500/15 text-amber-400' },
					].map(({ label, value, icon: Icon, color }) => (
						<div key={label} className="bg-surface border border-border/20 rounded-2xl p-4">
							<div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mb-2`}>
								<Icon className="w-4 h-4" />
							</div>
							<p className="text-xl font-black text-foreground truncate">{value}</p>
							<p className="text-xs text-muted">{label}</p>
						</div>
					))}
				</div>

				<div className="flex flex-wrap gap-2 mb-4">
					{(['all_time', 'last_30d', 'last_90d'] as const).map(w => (
						<button
							key={w}
							type="button"
							onClick={() => setEarnWindow(w)}
							className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
								earnWindow === w ? 'bg-foreground/10 text-foreground' : 'text-muted bg-foreground/5'
							}`}
						>
							{w.replace(/_/g, ' ')}
						</button>
					))}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<div className="bg-surface border border-border/20 rounded-2xl p-5">
						<h3 className="font-semibold text-foreground mb-4">Revenue series</h3>
						{series.length === 0 && !loading ? (
							<p className="text-xs text-muted">No series data</p>
						) : (
							<div className="flex items-end gap-2 h-32">
								{series.map((p, i) => {
									const v = BigInt(/^\d+$/.test(p.minor) ? p.minor : '0');
									const pct = Number((v * 100n) / maxMinor);
									return (
										<div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
											<div
												className="w-full rounded-t-lg bg-gradient-to-t from-emerald-700 to-emerald-400 transition-all"
												style={{ height: `${Math.max(4, pct)}%` }}
											/>
											<p className="text-[9px] text-muted/80 truncate w-full text-center">{p.label}</p>
										</div>
									);
								})}
							</div>
						)}
					</div>

					<div className="bg-surface border border-border/20 rounded-2xl p-5">
						<h3 className="font-semibold text-foreground mb-4">Top earners</h3>
						{earners.length === 0 && !loading ? (
							<p className="text-xs text-muted">No earners data</p>
						) : (
							<div className="space-y-3">
								{earners.map((creator, i) => {
									const maxE = earners[0]?.earningsMinor;
									const cur = creator.earningsMinor ?? '0';
									const pct =
										maxE && /^\d+$/.test(maxE) && /^\d+$/.test(cur) ?
											Number((BigInt(cur) * 100n) / BigInt(maxE)) :
											0;
									const name = creator.name ?? creator.username ?? 'Creator';
									const avatar = creator.avatar ?? '';
									return (
										<div key={creator.id ?? creator.userId ?? i} className="flex items-center gap-2">
											<p className="text-xs text-muted/80 w-4 shrink-0">{i + 1}</p>
											{avatar ? (
												<img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
											) : (
												<div className="w-6 h-6 rounded-full bg-foreground/10 shrink-0" />
											)}
											<p className="text-xs text-muted w-24 truncate">{name}</p>
											<div className="flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
												<div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full" style={{ width: `${pct}%` }} />
											</div>
											<p className="text-xs font-semibold text-muted w-20 text-right shrink-0">
												{formatINRFromMinor(cur)}
											</p>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-5">
					<h3 className="font-semibold text-foreground mb-4">Revenue breakdown</h3>
					{breakdownRows.length === 0 && !loading ? (
						<p className="text-xs text-muted">No breakdown data</p>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							{breakdownRows.map(({ label, minor }, idx) => (
								<div key={label + idx} className="bg-foreground/5 rounded-xl p-4 text-center">
									<p className="text-xl font-black text-foreground">{formatINRFromMinor(minor)}</p>
									<p className="text-xs text-muted">{label}</p>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
