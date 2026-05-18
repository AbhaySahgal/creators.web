import { useEffect, useState } from 'react';
import { ChevronDown, Heart, MessageCircle, DollarSign, Lock } from '../icons';
import { usePostInsights } from '../../hooks/usePostInsights';
import { formatINR } from '../../services/razorpay';
import { parseMinorStringToRupees } from '../../utils/creatorDashboardMonthlyStats';
import type { PostInsightsTimeSeriesPoint } from '../../services/postsTypes';

function seriesValue(pt: PostInsightsTimeSeriesPoint): number {
	if (typeof pt.value === 'number' && Number.isFinite(pt.value)) return pt.value;
	if (typeof pt.count === 'number' && Number.isFinite(pt.count)) return pt.count;
	return 0;
}

function seriesLabel(pt: PostInsightsTimeSeriesPoint, i: number): string {
	if (typeof pt.date === 'string' && pt.date.trim()) {
		const d = new Date(pt.date);
		if (Number.isFinite(d.getTime())) {
			return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
		return pt.date.trim();
	}
	return `Day ${i + 1}`;
}

function InsightsSkeleton() {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
			{[0, 1, 2, 3].map(i => (
				<div key={i} className="bg-foreground/5 rounded-xl h-16 animate-pulse" />
			))}
		</div>
	);
}

interface PostInsightsPanelProps {
	postId: string;
}

export function PostInsightsPanel({ postId }: PostInsightsPanelProps) {
	const [open, setOpen] = useState(false);
	const { data, loading, error, load } = usePostInsights(postId);

	useEffect(() => {
		if (!open) return;
		void load();
	}, [open, load]);

	const maxSeries = data?.time_series?.length ?
		Math.max(1, ...data.time_series.map(seriesValue)) :
		1;

	return (
		<div className="mt-1">
			<button
				type="button"
				onClick={() => { setOpen(v => !v); }}
				className="flex items-center justify-between w-full min-h-[44px] px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-border/20 transition-all text-left"
				aria-expanded={open}
			>
				<span className="text-sm font-medium text-foreground">View insights</span>
				<ChevronDown
					className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
				/>
			</button>

			{open && (
				<div className="mt-2 p-4 bg-surface border border-border/20 rounded-2xl">
					{loading && !data && <InsightsSkeleton />}

					{error && !loading && (
						<div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3">
							<p className="text-xs text-rose-200">{error}</p>
							<button
								type="button"
								onClick={() => { void load({ force: true }); }}
								className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 shrink-0"
							>
								Retry
							</button>
						</div>
					)}

					{data && (
						<>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
								<div className="bg-foreground/5 border border-border/10 rounded-xl p-3">
									<div className="flex items-center gap-1.5 text-muted mb-1">
										<Heart className="w-3.5 h-3.5" />
										<p className="text-[10px] font-medium uppercase tracking-wide">Likes</p>
									</div>
									<p className="text-lg font-bold text-foreground">{data.like_count.toLocaleString()}</p>
								</div>
								<div className="bg-foreground/5 border border-border/10 rounded-xl p-3">
									<div className="flex items-center gap-1.5 text-muted mb-1">
										<MessageCircle className="w-3.5 h-3.5" />
										<p className="text-[10px] font-medium uppercase tracking-wide">Comments</p>
									</div>
									<p className="text-lg font-bold text-foreground">{data.comment_count.toLocaleString()}</p>
								</div>
								<div className="bg-foreground/5 border border-border/10 rounded-xl p-3">
									<div className="flex items-center gap-1.5 text-muted mb-1">
										<DollarSign className="w-3.5 h-3.5" />
										<p className="text-[10px] font-medium uppercase tracking-wide">Tips</p>
									</div>
									<p className="text-lg font-bold text-foreground">{formatINR(parseMinorStringToRupees(data.tips_cents))}</p>
									<p className="text-[10px] text-muted">{data.tip_count} tips</p>
								</div>
								<div className="bg-foreground/5 border border-border/10 rounded-xl p-3">
									<div className="flex items-center gap-1.5 text-muted mb-1">
										<Lock className="w-3.5 h-3.5" />
										<p className="text-[10px] font-medium uppercase tracking-wide">PPV unlocks</p>
									</div>
									<p className="text-lg font-bold text-foreground">{data.ppv_unlock_count.toLocaleString()}</p>
								</div>
							</div>

							{data.time_series.length > 0 && (
								<div className="mt-4 pt-3 border-t border-border/15">
									<p className="text-xs text-muted font-medium mb-3">Activity over time</p>
									<div className="space-y-2">
										{data.time_series.map((pt, i) => {
											const v = seriesValue(pt);
											const pct = Math.round((v / maxSeries) * 100);
											return (
												<div key={`${seriesLabel(pt, i)}-${i}`} className="flex items-center gap-2">
													<span className="text-[10px] text-muted w-14 shrink-0 truncate" title={seriesLabel(pt, i)}>
														{seriesLabel(pt, i)}
													</span>
													<div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden">
														<div
															className="h-full rounded-full bg-rose-500/80 transition-all"
															style={{ width: `${pct}%` }}
														/>
													</div>
													<span className="text-[10px] text-muted w-8 text-right tabular-nums">{v}</span>
												</div>
											);
										})}
									</div>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
