import { Eye, Heart, Gift, Radio } from '../icons';
import { formatINR } from '../../services/razorpay';
import { parseMinorStringToRupees } from '../../utils/creatorDashboardMonthlyStats';
import type { ContentStreamItem } from '../../services/postsTypes';

function formatRelative(iso: string): string {
	const ms = new Date(iso).getTime();
	if (!Number.isFinite(ms)) return '';
	const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
	if (diffSec < 60) return 'just now';
	const m = Math.floor(diffSec / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

function visibilityLabel(v: ContentStreamItem['visibility']): string {
	if (v === 'followers') return 'Followers';
	if (v === 'subscribers') return 'Subscribers';
	return 'Everyone';
}

interface ContentStreamCardProps {
	stream: ContentStreamItem;
	/** `carousel` = fixed-width card for horizontal scroll strip */
	layout?: 'list' | 'carousel';
}

export function ContentStreamCard({ stream, layout = 'list' }: ContentStreamCardProps) {
	const banner = stream.banner_url?.trim();
	const started = formatRelative(stream.started_at);
	const ended = stream.ended_at ? formatRelative(stream.ended_at) : null;

	const bannerEl = banner ? (
		<img src={banner} alt="" className="w-full h-full object-cover" />
	) : (
		<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-foreground/10 to-foreground/5">
			<Radio className="w-6 h-6 text-muted/50" />
		</div>
	);

	const meta = (
		<>
			<div className="flex items-start gap-2 mb-1 flex-wrap">
				<span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-foreground/10 text-muted shrink-0">
					Ended
				</span>
				<span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted shrink-0">
					{visibilityLabel(stream.visibility)}
				</span>
			</div>
			<h3 className="text-sm font-semibold text-foreground truncate" title={stream.title}>
				{stream.title}
			</h3>
			<p className="text-[10px] text-muted mt-0.5 line-clamp-2">
				{started && <>Started {started}</>}
				{ended && <>{started ? ' · ' : ''}Ended {ended}</>}
			</p>
			<div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted">
				<span className="inline-flex items-center gap-1">
					<Eye className="w-3.5 h-3.5" />
					{stream.viewer_count.toLocaleString()}
				</span>
				<span className="inline-flex items-center gap-1">
					<Heart className="w-3.5 h-3.5" />
					{stream.like_count.toLocaleString()}
				</span>
				<span className="inline-flex items-center gap-1" title="Tips">
					<Gift className="w-3.5 h-3.5 shrink-0" />
					<span>{formatINR(parseMinorStringToRupees(stream.tip_total_minor))}</span>
				</span>
			</div>
		</>
	);

	if (layout === 'carousel') {
		return (
			<article
				className={
					'flex flex-col w-[272px] shrink-0 snap-start bg-surface border border-border/20 ' +
					'rounded-2xl overflow-hidden hover:border-border/30 transition-all'
				}
			>
				<div className="h-28 w-full overflow-hidden bg-foreground/5 border-b border-border/10">
					{bannerEl}
				</div>
				<div className="p-3 min-w-0">{meta}</div>
			</article>
		);
	}

	return (
		<article className="flex gap-3 p-3 bg-surface border border-border/20 rounded-2xl hover:border-border/30 transition-all">
			<div className="w-24 h-16 rounded-lg shrink-0 overflow-hidden bg-foreground/5 border border-border/10">
				{bannerEl}
			</div>
			<div className="min-w-0 flex-1">{meta}</div>
		</article>
	);
}
