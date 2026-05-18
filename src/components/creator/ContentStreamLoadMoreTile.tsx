import { ChevronRight, Loader2 } from '../icons';

interface ContentStreamLoadMoreTileProps {
	onClick: () => void;
	loading?: boolean;
	disabled?: boolean;
}

/** Terminal tile at the end of the past-streams horizontal strip. */
export function ContentStreamLoadMoreTile({
	onClick,
	loading = false,
	disabled = false,
}: ContentStreamLoadMoreTileProps) {
	const inactive = disabled || loading;

	return (
		<div
			role="button"
			tabIndex={inactive ? -1 : 0}
			aria-busy={loading}
			aria-disabled={inactive}
			onClick={() => {
				if (!inactive) onClick();
			}}
			onKeyDown={e => {
				if (inactive) return;
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick();
				}
			}}
			className={
				'group flex flex-col items-center justify-center gap-3 w-[272px] shrink-0 snap-start ' +
				'min-h-[200px] rounded-2xl border border-dashed border-border/30 ' +
				'bg-surface hover:bg-foreground/[0.03] hover:border-rose-500/35 ' +
				'transition-all cursor-pointer select-none ' +
				`${inactive ? 'opacity-50 pointer-events-none' : ''} ` +
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40'
			}
		>
			<span
				className={
					'w-11 h-11 rounded-full flex items-center justify-center ' +
					'bg-foreground/5 border border-border/20 ' +
					'group-hover:bg-rose-500/10 group-hover:border-rose-500/25 transition-colors'
				}
			>
				{loading ?
					<Loader2 className="w-5 h-5 text-rose-400 animate-spin" /> :
					<ChevronRight className="w-5 h-5 text-muted group-hover:text-rose-400 transition-colors" />}
			</span>
			<span className="text-center px-4 pointer-events-none">
				<span className="block text-sm font-semibold text-foreground">
					{loading ? 'Loading…' : 'Load more'}
				</span>
				<span className="block text-[10px] text-muted mt-1">
					Swipe for more
				</span>
			</span>
		</div>
	);
}
