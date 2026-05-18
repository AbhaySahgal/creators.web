import { Loader2 } from '../icons';

interface MediaProcessingPlaceholderProps {
	kind?: 'image' | 'video';
	className?: string;
}

export function MediaProcessingPlaceholder({ kind = 'image', className = '' }: MediaProcessingPlaceholderProps) {
	const aspect = kind === 'video' ? 'aspect-video' : 'aspect-[4/3]';
	return (
		<div
			className={
				`${aspect} w-full rounded-xl bg-foreground/5 border border-dashed border-border/30 ` +
				`flex flex-col items-center justify-center gap-2 ${className}`
			}
		>
			<Loader2 className="w-8 h-8 text-amber-400/80 animate-spin" />
			<p className="text-xs text-muted font-medium">Processing media…</p>
			<p className="text-[10px] text-muted/70">This usually takes a few moments</p>
		</div>
	);
}
