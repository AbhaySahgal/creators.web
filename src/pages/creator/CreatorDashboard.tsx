import { useEffect, useState } from 'react';
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
import { mockCreators } from '../../data/users';
import { minimalCreatorFromUser } from '../../utils/creatorShell';
import { formatINR } from '../../services/razorpay';
import { formatINRFromMinor, inrRupeesToMinor } from '../../utils/money';
import { creatorsApi } from '../../services/creatorsApi';

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

export function CreatorDashboard() {
	const navigate = useNavigate();
	const creator = useCurrentCreator();
	const { state: authState, updateUser } = useAuth();
	const { state: contentState, loadCreatorPosts } = useContent();
	const { state: sessionState } = useSession();
	const [editingRate, setEditingRate] = useState(false);
	const [rateInput, setRateInput] = useState('');
	const [rateSaving, setRateSaving] = useState(false);

	const authedCreatorId = authState.user?.id ?? '';
	const creatorData = creator ?? (authState.user?.role === 'creator' ?
		minimalCreatorFromUser(authState.user) :
		mockCreators[0]);
	const creatorUserIdForPosts = authedCreatorId || creatorData.id;

	useEffect(() => {
		if (!creatorUserIdForPosts) return;
		void loadCreatorPosts(creatorUserIdForPosts, true);
	}, [creatorUserIdForPosts, loadCreatorPosts]);

	const creatorPosts = contentState.posts.filter(p => p.creatorId === creatorUserIdForPosts);

	const creatorSessions = sessionState.sessionHistory.filter(s => s.creatorId === creatorUserIdForPosts);
	const sessionEarnings = creatorSessions.reduce((sum, s) => sum + s.earnings, 0);

	const dashboard = authState.user?.creatorDashboard;
	const kycStatus = dashboard?.kycStatus ?? creatorData.kycStatus;

	if (kycStatus !== 'approved') {
		return (
			<Layout>
				<div className="max-w-lg mx-auto px-4 py-12 text-center">
					<div className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Star className="w-8 h-8 text-amber-400" />
					</div>
					<h2 className="text-xl font-bold text-foreground mb-2">
						{kycStatus === 'pending' ? 'KYC Verification Pending' :
						kycStatus === 'rejected' ? 'KYC Rejected' :
						'Complete KYC Verification'}
					</h2>
					<p className="text-muted text-sm mb-6">
						{kycStatus === 'pending' ?
							'Your identity verification is being reviewed. This usually takes 1-2 business days.' :
							kycStatus === 'rejected' ?
								'Your KYC was rejected. Please resubmit with clearer documents.' :
								'Verify your identity to start earning on creators.web.'}
					</p>
					<button
						type="button"
						onClick={() => { void navigate('/creator-dashboard/kyc'); }}
						className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
					>
						{kycStatus === 'rejected' ? 'Resubmit KYC' : 'Submit KYC Documents'}
					</button>
				</div>
			</Layout>
		);
	}

	const dashMonthly = dashboard?.monthlyStats ?? [];
	const lastMonthCents = dashMonthly.length >= 2 ? Number(dashMonthly[dashMonthly.length - 2]?.earningsCents ?? 0) : 0;
	const thisMonthCents = dashMonthly.length >= 1 ? Number(dashMonthly[dashMonthly.length - 1]?.earningsCents ?? 0) : 0;
	const earningsGrowth =
		lastMonthCents > 0 ? (((thisMonthCents - lastMonthCents) / lastMonthCents) * 100).toFixed(1) : 0;

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
						value={dashboard ? formatINRFromMinor(dashboard.monthlyEarningsCents) : formatINR(creatorData.monthlyEarnings)}
						sub={`+${earningsGrowth}% vs last month`}
						icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
						color="bg-emerald-500/15"
						onClick={() => { void navigate('/creator-dashboard/earnings'); }}
					/>
					<StatCard
						label="Subscribers"
						value={(dashboard ? dashboard.subscriberCount : creatorData.subscriberCount).toLocaleString()}
						sub="Active this month"
						icon={<Users className="w-5 h-5 text-blue-400" />}
						color="bg-blue-500/15"
						onClick={() => { void navigate('/creator-dashboard/subscribers'); }}
					/>
					<StatCard
						label="Session Earnings"
						value={dashboard ? formatINRFromMinor(dashboard.earningsBySource.sessionsCents) : formatINR(sessionEarnings)}
						sub={`${dashboard ? dashboard.sessionHistory.length : creatorSessions.length} sessions`}
						icon={<Zap className="w-5 h-5 text-amber-400" />}
						color="bg-amber-500/15"
					/>
					<StatCard
						label="Total Earnings"
						value={dashboard ? formatINRFromMinor(dashboard.totalEarningsCents) : formatINR(creatorData.totalEarnings)}
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
								onClick={() => {
									const rupees =
										dashboard?.perMinuteRateCents != null ? dashboard.perMinuteRateCents / 100 :
										creatorData.perMinuteRate;
									setRateInput(rupees.toFixed(2));
									setEditingRate(true);
								}}
								className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
							>
								Edit Rate
							</button>
						) : (
							<button
								onClick={() => setEditingRate(false)}
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
								onClick={() => {
									if (rateSaving) return;
									const parsed = Math.max(0, parseFloat(rateInput) || 0);
									const minor = Number(inrRupeesToMinor(parsed));
									if (!Number.isFinite(minor) || minor < 0) { setEditingRate(false); return; }
									setRateSaving(true);
									void creatorsApi.me.updateProfile({ perMinuteRate: minor })
										.then(() => creatorsApi.auth.me())
										.then(r => { if (r.user) updateUser(r.user); })
										.catch(() => {})
										.finally(() => { setRateSaving(false); setEditingRate(false); });
								}}
								className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
							>
								{rateSaving ? 'Saving…' : 'Save'}
							</button>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<div className="text-3xl font-black text-foreground">
								{dashboard?.perMinuteRateCents != null ? formatINRFromMinor(String(dashboard.perMinuteRateCents)) : formatINR(creatorData.perMinuteRate)}
							</div>
							<span className="text-muted/80 text-sm">/minute</span>
							<div className="ml-auto flex flex-col items-end gap-1">
								{[5, 10, 15].map(m => (
									<div key={m} className="flex items-center gap-2 text-xs text-muted/80">
										<Clock className="w-3 h-3" />
										{(() => {
											const rupeesPerMin =
												dashboard?.perMinuteRateCents != null ? dashboard.perMinuteRateCents / 100 :
												creatorData.perMinuteRate;
											return (
												<>
													{m}min = <span className="text-foreground/80 font-semibold">{formatINR(m * rupeesPerMin)}</span>
												</>
											);
										})()}
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
							{(dashboard ? dashboard.monthlyStats.map(s => ({ month: s.month, earningsMinor: s.earningsCents })) : creatorData.monthlyStats.map(s => ({ month: s.month, earningsMinor: String(Math.round(s.earnings * 100)) }))).map((stat, i, arr) => {
								const max = Math.max(1, ...arr.map(s => Number(s.earningsMinor) || 0));
								const pct = ((Number(stat.earningsMinor) || 0) / max) * 100;
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
						{(dashboard ? dashboard.sessionHistory : creatorSessions).length === 0 ? (
							<div className="flex flex-col items-center justify-center py-4">
								<p className="text-xs text-muted">No sessions yet</p>
							</div>
						) : (
							<div className="space-y-2.5">
								{(dashboard ? dashboard.sessionHistory : creatorSessions).slice(0, 4).map((sess: any) => {
									const typeRaw = dashboard ? (sess.type === 'call' ? 'audio' : 'chat') : sess.type;
									const typeInfo = formatSessionType(typeRaw);
									const Icon = typeInfo.icon;
									return (
										<div key={dashboard ? sess.requestId : sess.id} className="flex items-center gap-2.5">
											<div className="w-9 h-9 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
												<Icon className={`w-4 h-4 ${typeInfo.color}`} />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-xs text-foreground/80 font-medium truncate">{sess.fanName}</p>
												<p className="text-[10px] text-muted/80">
													{typeInfo.label} · {dashboard ? (sess.durationMinutes ?? 0) : sess.durationMinutes}min
													{!dashboard && sess.actualDurationSeconds && ` · ${formatDuration(sess.actualDurationSeconds)}`}
												</p>
											</div>
											<span className="text-xs font-bold text-emerald-400">
												+{dashboard ? formatINRFromMinor(sess.earningsCents) : formatINR(sess.earnings)}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</div>
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
