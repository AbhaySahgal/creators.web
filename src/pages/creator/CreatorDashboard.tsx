import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	TrendingUp,
	Users,
	Zap,
	DollarSign,
	ArrowRight,
	Star,
	Eye,
	Radio,
	MessageCircle,
	Phone,
	Video,
	Clock,
} from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { useAuth, useCurrentCreator } from '../../context/AuthContext';
import { useContent } from '../../context/ContentContext';
import { useSession } from '../../context/SessionContext';
import { useNotifications } from '../../context/NotificationContext';
import { mockCreators } from '../../data/users';
import { formatINR } from '../../services/razorpay';
import { ApiError, creatorsApi } from '../../services/creatorsApi';
import type { CreatorFollowerUserSummary } from '../../services/creatorWsTypes';
import { minorStringToInrNumber } from '../../utils/money';

function StatCard({ label, value, sub, icon, color, onClick }: {
	label: string, value: string, sub?: string, icon: React.ReactNode, color: string, onClick?: () => void,
}) {
	return (
		<button
			onClick={onClick}
			className={`bg-surface border border-border/20 rounded-2xl p-4 text-left hover:border-border/30 transition-all group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
		>
			<div className="flex items-start justify-between mb-3">
				<div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
					{icon}
				</div>
				{onClick && <ArrowRight className="w-4 h-4 text-muted/70 group-hover:text-foreground/80 transition-colors" />}
			</div>
			<p className="text-2xl font-black text-foreground mb-0.5">{value}</p>
			<p className="text-xs text-muted font-medium">{label}</p>
			{sub && <p className="text-xs text-muted/80 mt-0.5">{sub}</p>}
		</button>
	);
}

function formatSessionType(type: string) {
	if (type === 'chat') return { label: 'Chat', icon: MessageCircle, color: 'text-emerald-400' };
	if (type === 'audio') return { label: 'Audio', icon: Phone, color: 'text-sky-400' };
	return { label: 'Video', icon: Video, color: 'text-rose-400' };
}

function formatDuration(secs: number): string {
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

type RecentSessionRow = {
	id: string,
	type: string,
	fanName: string,
	durationMinutes: number,
	actualDurationSeconds?: number,
	earnings: number,
};

export function CreatorDashboard() {
	const navigate = useNavigate();
	const creator = useCurrentCreator();
	const { state: authState, updateUser } = useAuth();
	const { showToast } = useNotifications();
	const { state: contentState, loadCreatorPosts, creatorWsListFollowers, postsWsStatus } = useContent();
	const { state: sessionState } = useSession();
	const [editingRate, setEditingRate] = useState(false);
	const [rateInput, setRateInput] = useState('');
	const [rateSaving, setRateSaving] = useState(false);
	const [socialFollowers, setSocialFollowers] = useState<CreatorFollowerUserSummary[]>([]);
	const [socialFollowersLoading, setSocialFollowersLoading] = useState(false);

	const dash = authState.user?.role === 'creator' ? authState.user.creatorDashboard : undefined;

	const authedCreatorId = authState.user?.id ?? '';
	const creatorData = creator ?? (authState.user?.role === 'creator' ? {
		...mockCreators[0],
		id: authState.user.id,
		name: authState.user.name,
		email: authState.user.email,
		username: authState.user.username,
		avatar: authState.user.avatar,
	} : mockCreators[0]);
	const creatorUserIdForPosts = authedCreatorId || creatorData.id;

	const effectiveKyc = dash?.kycStatus ?? creatorData.kycStatus;

	const monthlyStatsForChart = useMemo(() => {
		if (dash?.monthlyStats?.length) {
			return dash.monthlyStats.map(m => ({
				month: m.month,
				earnings: minorStringToInrNumber(m.earningsCents),
				subscribers: 0,
				tips: 0,
			}));
		}
		return creatorData.monthlyStats;
	}, [dash, creatorData.monthlyStats]);

	const creatorSessions = sessionState.sessionHistory.filter(s => s.creatorId === creatorUserIdForPosts);
	const sessionEarningsLocal = creatorSessions.reduce((sum, s) => sum + s.earnings, 0);

	const sessionEarningsDisplay = dash ?
		minorStringToInrNumber(dash.earningsBySource?.sessionsCents ?? '0') :
		sessionEarningsLocal;

	const sessionCountDisplay = dash?.sessionHistory?.length ?
		dash.sessionHistory.length :
		creatorSessions.length;

	const totalEarningsDisplay = dash ?
		minorStringToInrNumber(dash.totalEarningsCents) :
		creatorData.totalEarnings;

	const monthlyEarningsDisplay = dash ?
		minorStringToInrNumber(dash.monthlyEarningsCents) :
		creatorData.monthlyEarnings;

	const subscribersDisplay = dash ? dash.subscriberCount : creatorData.subscriberCount;

	const recentSessions = useMemo((): RecentSessionRow[] => {
		if (dash?.sessionHistory?.length) {
			return dash.sessionHistory.slice(0, 4).map(h => ({
				id: h.requestId,
				type: h.type === 'chat' ? 'chat' : 'video',
				fanName: h.fanName || 'Fan',
				durationMinutes: h.durationMinutes ?? 0,
				earnings: minorStringToInrNumber(h.earningsCents),
			}));
		}
		return creatorSessions.slice(0, 4).map(s => ({
			id: s.id,
			type: s.type,
			fanName: s.fanName,
			durationMinutes: s.durationMinutes,
			actualDurationSeconds: s.actualDurationSeconds,
			earnings: s.earnings,
		}));
	}, [dash, creatorSessions]);

	const lastMonth = monthlyStatsForChart.length >= 2 ? monthlyStatsForChart[monthlyStatsForChart.length - 2] : undefined;
	const thisMonth = monthlyStatsForChart.length >= 1 ? monthlyStatsForChart[monthlyStatsForChart.length - 1] : undefined;
	const earningsGrowth = lastMonth && thisMonth && lastMonth.earnings > 0 ?
		((thisMonth.earnings - lastMonth.earnings) / lastMonth.earnings * 100).toFixed(1) :
		'0';

	const chartMax = monthlyStatsForChart.length ?
		Math.max(...monthlyStatsForChart.map(s => s.earnings), 1) :
		1;

	function savePerMinuteRate() {
		const paisePerMin = Math.max(0, Math.round(Number(rateInput) * 100));
		if (!Number.isFinite(paisePerMin)) {
			showToast('Enter a valid rate.', 'error');
			return;
		}
		setRateSaving(true);
		void creatorsApi.me.updateProfile({ perMinuteRate: paisePerMin })
			.then(({ user }) => {
				updateUser(user);
				showToast('Per-minute rate updated');
				setEditingRate(false);
			})
			.catch(err => {
				const msg =
					err instanceof ApiError &&
					typeof err.body === 'object' && err.body && 'error' in err.body &&
					typeof (err.body as { error?: unknown }).error === 'string' ?
						(err.body as { error: string }).error :
						err instanceof Error ? err.message :
						'Could not update rate.';
				showToast(msg, 'error');
			})
			.finally(() => setRateSaving(false));
	}

	useEffect(() => {
		if (!creatorUserIdForPosts) return;
		void loadCreatorPosts(creatorUserIdForPosts, true);
	}, [creatorUserIdForPosts, loadCreatorPosts]);

	useEffect(() => {
		if (!authedCreatorId || postsWsStatus !== 'ready') return;
		let cancelled = false;
		setSocialFollowersLoading(true);
		void creatorWsListFollowers(authedCreatorId, 12)
			.then(r => {
				if (!cancelled) setSocialFollowers(r.followers ?? []);
			})
			.catch(() => {
				if (!cancelled) setSocialFollowers([]);
			})
			.finally(() => {
				if (!cancelled) setSocialFollowersLoading(false);
			});
		return () => { cancelled = true; };
	}, [authedCreatorId, postsWsStatus, creatorWsListFollowers]);

	const creatorPosts = contentState.posts.filter(p => p.creatorId === creatorUserIdForPosts);

	if (effectiveKyc !== 'approved') {
		return (
			<Layout>
				<div className="max-w-lg mx-auto px-4 py-12 text-center">
					<div className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Star className="w-8 h-8 text-amber-400" />
					</div>
					<h2 className="text-xl font-bold text-foreground mb-2">
						{effectiveKyc === 'pending' ? 'KYC Verification Pending' :
						effectiveKyc === 'rejected' ? 'KYC Rejected' :
						'Complete KYC Verification'}
					</h2>
					<p className="text-muted text-sm mb-6">
						{effectiveKyc === 'pending' ?
							'Your identity verification is being reviewed. This usually takes 1-2 business days.' :
							effectiveKyc === 'rejected' ?
								'Your KYC was rejected. Please resubmit with clearer documents.' :
								'Verify your identity to start earning on creators.web.'}
					</p>
					<button
						type="button"
						onClick={() => { void navigate('/creator-dashboard/kyc'); }}
						className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
					>
						{effectiveKyc === 'rejected' ? 'Resubmit KYC' : 'Submit KYC Documents'}
					</button>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="max-w-4xl mx-auto px-4 py-6">
				<div className="flex items-start justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
						<p className="text-muted text-sm">Welcome back, {creatorData.name.split(' ')[0]}</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => { void navigate('/go-live'); }}
							className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-sm font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
						>
							<Radio className="w-4 h-4" />
							Go Live
						</button>
						<button
							type="button"
							onClick={() => { void navigate('/creator-dashboard/content'); }}
							className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
						>
							+ New Post
						</button>
					</div>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					<StatCard
						label="Monthly Earnings"
						value={formatINR(monthlyEarningsDisplay)}
						sub={`+${earningsGrowth}% vs last month`}
						icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
						color="bg-emerald-500/15"
						onClick={() => { void navigate('/creator-dashboard/earnings'); }}
					/>
					<StatCard
						label="Subscribers"
						value={subscribersDisplay.toLocaleString()}
						sub="Active this month"
						icon={<Users className="w-5 h-5 text-blue-400" />}
						color="bg-blue-500/15"
						onClick={() => { void navigate('/creator-dashboard/subscribers'); }}
					/>
					<StatCard
						label="Session Earnings"
						value={formatINR(sessionEarningsDisplay)}
						sub={`${sessionCountDisplay} sessions`}
						icon={<Zap className="w-5 h-5 text-amber-400" />}
						color="bg-amber-500/15"
					/>
					<StatCard
						label="Total Earnings"
						value={formatINR(totalEarningsDisplay)}
						sub="All time"
						icon={<TrendingUp className="w-5 h-5 text-rose-400" />}
						color="bg-rose-500/15"
					/>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-4 mb-4">
					<div className="flex items-center justify-between mb-3">
						<div>
							<h3 className="text-sm font-semibold text-foreground">Per-Minute Rate</h3>
							<p className="text-xs text-muted mt-0.5">Charged for chat, audio & video sessions</p>
						</div>
						{!editingRate ? (
							<button
								onClick={() => { setRateInput(creatorData.perMinuteRate.toFixed(2)); setEditingRate(true); }}
								className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
							>
								Edit Rate
							</button>
						) : (
							<button
								onClick={() => { setEditingRate(false); }}
								className="text-xs text-muted hover:text-foreground font-semibold transition-colors"
							>
								Cancel
							</button>
						)}
					</div>
					{editingRate ? (
						<div className="flex items-center gap-3">
							<div className="flex-1 flex items-center gap-2 bg-input border border-border/20 rounded-xl px-3 py-2">
								<span className="text-muted text-sm">₹</span>
								<input
									type="number"
									min="0.50"
									max="99.99"
									step="0.01"
									value={rateInput}
									onChange={e => setRateInput(e.target.value)}
									className="flex-1 bg-transparent text-foreground text-sm focus:outline-none"
								/>
								<span className="text-muted text-xs">/min</span>
							</div>
							<button
								type="button"
								disabled={rateSaving}
								onClick={() => { savePerMinuteRate(); }}
								className="bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
							>
								{rateSaving ? 'Saving…' : 'Save'}
							</button>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<div className="text-3xl font-black text-foreground">{formatINR(creatorData.perMinuteRate)}</div>
							<span className="text-muted/80 text-sm">/minute</span>
							<div className="ml-auto flex flex-col items-end gap-1">
								{[5, 10, 15].map(m => (
									<div key={m} className="flex items-center gap-2 text-xs text-muted/80">
										<Clock className="w-3 h-3" />
										{m}min = <span className="text-foreground/80 font-semibold">{formatINR(m * creatorData.perMinuteRate)}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-semibold text-foreground">Earnings (6 months)</h3>
							<TrendingUp className="w-4 h-4 text-rose-400" />
						</div>
						<div className="flex items-end gap-1.5 h-24">
							{monthlyStatsForChart.map((stat, i) => {
								const pct = (stat.earnings / chartMax) * 100;
								return (
									<div key={i} className="flex-1 flex flex-col items-center gap-1">
										<div
											className="w-full rounded-t-lg bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-500"
											style={{ height: `${pct}%` }}
										/>
										<p className="text-[9px] text-muted/80">{stat.month}</p>
									</div>
								);
							})}
						</div>
					</div>

					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-semibold text-foreground">Recent Sessions</h3>
						</div>
						{recentSessions.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-4">
								<p className="text-xs text-muted">No sessions yet</p>
							</div>
						) : (
							<div className="space-y-2.5">
								{recentSessions.map(sess => {
									const typeInfo = formatSessionType(sess.type);
									const Icon = typeInfo.icon;
									return (
										<div key={sess.id} className="flex items-center gap-2.5">
											<div className="w-9 h-9 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
												<Icon className={`w-4 h-4 ${typeInfo.color}`} />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-xs text-foreground/80 font-medium truncate">{sess.fanName}</p>
												<p className="text-[10px] text-muted/80">
													{typeInfo.label} · {sess.durationMinutes}min
													{sess.actualDurationSeconds ? ` · ${formatDuration(sess.actualDurationSeconds)}` : ''}
												</p>
											</div>
											<span className="text-xs font-bold text-emerald-400">+{formatINR(sess.earnings)}</span>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-4 mb-4">
					<div className="flex items-center justify-between mb-3">
						<div>
							<h3 className="text-sm font-semibold text-foreground">Recent followers (social)</h3>
							<p className="text-[10px] text-muted/80 mt-0.5">Loaded via <code className="text-[10px] bg-foreground/5 px-1 rounded">creator /listfollowers</code> (social follows, not paid subscribers).</p>
						</div>
						<Users className="w-4 h-4 text-muted/70" />
					</div>
					{socialFollowersLoading ? (
						<p className="text-xs text-muted py-2">Loading…</p>
					) : socialFollowers.length === 0 ? (
						<p className="text-xs text-muted py-2">No social followers yet, or the server returned an empty list.</p>
					) : (
						<div className="space-y-2.5">
							{socialFollowers.map(f => (
								<div key={f.id} className="flex items-center gap-2.5">
									{f.avatar_url ? (
										<img src={f.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
									) : (
										<div className="w-9 h-9 rounded-full bg-foreground/10 shrink-0" />
									)}
									<div className="flex-1 min-w-0">
										<p className="text-xs font-medium text-foreground truncate">{f.name}</p>
										<p className="text-[10px] text-muted/80 truncate">@{f.username}</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<h3 className="text-sm font-semibold text-foreground mb-3">Recent Posts</h3>
						<div className="space-y-2.5">
							{creatorPosts.slice(0, 4).map(post => (
								<div key={post.id} className="flex items-center gap-2.5">
									{post.mediaUrl ? (
										<img src={post.mediaUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
									) : (
										<div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
											<span className="text-xs text-muted">T</span>
										</div>
									)}
									<div className="flex-1 min-w-0">
										<p className="text-xs text-foreground/80 truncate">{post.text.slice(0, 50)}...</p>
										<div className="flex items-center gap-2 mt-0.5">
											<span className="text-[10px] text-muted/80 flex items-center gap-0.5">
												<Eye className="w-2.5 h-2.5" /> {post.likes}
											</span>
											{post.isLocked && <span className="text-[10px] text-rose-400">Locked</span>}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="bg-surface border border-border/20 rounded-2xl p-4">
						<h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
						<div className="grid grid-cols-2 gap-2">
							{[
								{ label: 'Go Live', path: '/go-live', color: 'bg-rose-500/15 text-rose-400' },
								{ label: 'Earnings', path: '/creator-dashboard/earnings', color: 'bg-emerald-500/15 text-emerald-400' },
								{ label: 'Subscribers', path: '/creator-dashboard/subscribers', color: 'bg-blue-500/15 text-blue-400' },
								{ label: 'Edit Profile', path: '/creator-dashboard/profile', color: 'bg-amber-500/15 text-amber-400' },
							].map(({ label, path, color }) => (
								<button
									type="button"
									key={label}
									onClick={() => { void navigate(path); }}
									className={`${color} rounded-xl py-2.5 text-xs font-semibold transition-all hover:opacity-80`}
								>
									{label}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
}
