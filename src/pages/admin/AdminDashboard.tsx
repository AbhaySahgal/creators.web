import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, Shield, AlertTriangle, DollarSign, Star, ArrowRight } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer } from '../../components/ui/Toast';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { adminOverview, adminTopCreators } from '../../services/adminWs';
import type { AdminTopCreatorRow } from '../../services/adminWsTypes';
import { formatINR } from '../../services/razorpay';
import { formatINRFromMinor } from '../../utils/money';
import { humanizeWsBackendError } from '../../utils/wsBackendError';

export function AdminDashboard() {
	const navigate = useNavigate();
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();

	const [totalUsers, setTotalUsers] = useState<number | null>(null);
	const [activeCreators, setActiveCreators] = useState<number | null>(null);
	const [platformRevenueLabel, setPlatformRevenueLabel] = useState<string>('—');
	const [pendingKyc, setPendingKyc] = useState<number | null>(null);
	const [pendingReports, setPendingReports] = useState<number | null>(null);
	const [topCreators, setTopCreators] = useState<AdminTopCreatorRow[]>([]);
	const [recentReports, setRecentReports] = useState<{ reason: string; reporterName: string; targetType: string; status: string }[]>([]);
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
				const [ov, top] = await Promise.all([
					adminOverview(ws),
					adminTopCreators(ws, 4, 'monthlyEarnings'),
				]);
				if (cancelled) return;
				if (typeof ov.totalUsers === 'number') setTotalUsers(ov.totalUsers);
				if (typeof ov.activeCreators === 'number') setActiveCreators(ov.activeCreators);
				if (ov.platformRevenueMinor != null) {
					setPlatformRevenueLabel(formatINRFromMinor(ov.platformRevenueMinor));
				} else if (typeof ov.platformRevenue === 'number') {
					setPlatformRevenueLabel(formatINR(ov.platformRevenue));
				}
				if (typeof ov.pendingKycCount === 'number') setPendingKyc(ov.pendingKycCount);
				if (typeof ov.pendingReportsCount === 'number') setPendingReports(ov.pendingReportsCount);
				const items = top.items ?? [];
				setTopCreators(items);
				const rawRecent = (ov as { recentReports?: typeof recentReports }).recentReports;
				if (Array.isArray(rawRecent)) setRecentReports(rawRecent.slice(0, 6));
				else setRecentReports([]);
			} catch (e) {
				if (!cancelled) {
					setError(humanizeWsBackendError(e instanceof Error ? e.message : 'Failed to load dashboard'));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [ensureWsAuth, ws, wsAuthReady, wsConnected]);

	const stats = [
		{ label: 'Total Users', value: totalUsers != null ? String(totalUsers) : (loading ? '…' : '—'), icon: Users, color: 'bg-blue-500/15 text-blue-400', path: '/admin/users' },
		{ label: 'Active Creators', value: activeCreators != null ? String(activeCreators) : (loading ? '…' : '—'), icon: Star, color: 'bg-rose-500/15 text-rose-400', path: '/admin/creators' },
		{ label: 'Platform Revenue', value: platformRevenueLabel, icon: DollarSign, color: 'bg-emerald-500/15 text-emerald-400', path: '/admin/analytics' },
		{ label: 'Pending KYC', value: pendingKyc != null ? String(pendingKyc) : (loading ? '…' : '—'), icon: Shield, color: 'bg-amber-500/15 text-amber-400', path: '/admin/creators' },
		{ label: 'Open Reports', value: pendingReports != null ? String(pendingReports) : (loading ? '…' : '—'), icon: AlertTriangle, color: 'bg-red-500/15 text-red-400', path: '/admin/moderation' },
		{ label: 'Analytics', value: 'Open', icon: TrendingUp, color: 'bg-foreground/10 text-muted', path: '/admin/analytics' },
	];

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
				<div className="mb-6">
					<h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
					<p className="text-muted text-sm">Platform management and moderation</p>
					{error && (
						<p className="text-sm text-rose-400 mt-2">{error}</p>
					)}
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
					{stats.map(({ label, value, icon: Icon, color, path }) => (
						<button
							key={label}
							type="button"
							onClick={() => void navigate(path)}
							className="bg-surface border border-border/20 rounded-2xl p-4 text-left hover:border-border/30 transition-all group"
						>
							<div className="flex items-start justify-between mb-3">
								<div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
									<Icon className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-muted/70 group-hover:text-foreground/80 transition-colors" />
							</div>
							<p className="text-2xl font-black text-foreground">{value}</p>
							<p className="text-xs text-muted">{label}</p>
						</button>
					))}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-semibold text-foreground text-sm">Top Creators</h3>
							<button type="button" onClick={() => void navigate('/admin/analytics')} className="text-xs text-rose-400">Analytics</button>
						</div>
						<div className="space-y-3">
							{topCreators.length === 0 && !loading ? (
								<p className="text-xs text-muted">No data</p>
							) : (
								topCreators.map((creator, i) => {
									const name = creator.name ?? creator.username ?? 'Creator';
									const avatar = creator.avatar ?? creator.avatarUrl ?? '';
									const subs = typeof creator.subscriberCount === 'number' ? creator.subscriberCount : 0;
									const monthlyMinor = creator.monthlyEarningsMinor ?? creator.totalEarningsMinor;
									const moLabel = monthlyMinor ? formatINRFromMinor(monthlyMinor) : '—';
									return (
										<div key={creator.id ?? creator.userId ?? String(i)} className="flex items-center gap-3">
											{avatar ? (
												<img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
											) : (
												<div className="w-9 h-9 rounded-full bg-foreground/10" />
											)}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-foreground truncate">{name}</p>
												<p className="text-xs text-muted">{subs.toLocaleString()} subscribers</p>
											</div>
											<span className="text-xs font-semibold text-emerald-400">{moLabel}/mo</span>
										</div>
									);
								})
							)}
						</div>
					</div>

					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-semibold text-foreground text-sm">Recent Reports</h3>
							<button type="button" onClick={() => void navigate('/admin/moderation')} className="text-xs text-rose-400">View all</button>
						</div>
						<div className="space-y-3">
							{recentReports.length === 0 ? (
								<p className="text-xs text-muted">{loading ? 'Loading…' : 'Open moderation for full queue'}</p>
							) : (
								recentReports.map((report, idx) => (
									<div key={idx} className="flex items-start gap-2">
										<div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${report.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
										<div className="flex-1 min-w-0">
											<p className="text-xs font-medium text-foreground/80 truncate">{report.reason}</p>
											<p className="text-[10px] text-muted/80">{report.reporterName} · {report.targetType}</p>
										</div>
										<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
											report.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
										}`}
										>
											{report.status}
										</span>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-4">
					<div className="flex items-center justify-between mb-3">
						<h3 className="font-semibold text-foreground text-sm">Revenue and analytics</h3>
						<button type="button" onClick={() => void navigate('/admin/analytics')} className="text-xs text-rose-400">Open analytics</button>
					</div>
					<p className="text-xs text-muted">Charts and breakdowns use Phase 5 commands on the analytics page.</p>
				</div>
			</div>
		</div>
	);
}
