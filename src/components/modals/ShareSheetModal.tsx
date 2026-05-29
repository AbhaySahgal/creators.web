import { Share2, X } from '../icons';
import { Modal } from '../ui/Toast';
import { Button } from '../ui/Button';
import type { ShareMetadata, ShareTargetType } from '../../services/shareTypes';
import type { ShareSheetVariant } from '../../hooks/useShareSheet';

export interface ShareSheetModalProps {
	isOpen: boolean;
	onClose: () => void;
	variant?: ShareSheetVariant;
	targetType: ShareTargetType;
	metadata: ShareMetadata | null;
	loading: boolean;
	error: string;
	actionBusy: boolean;
	canNativeShare: boolean;
	onRetry: () => void;
	onNativeShare: () => void;
}

function ShareSkeleton() {
	return (
		<div className="animate-pulse space-y-4">
			<div className="flex gap-3 p-3 rounded-xl bg-foreground/5">
				<div className="w-14 h-14 rounded-lg bg-foreground/10 shrink-0" />
				<div className="flex-1 space-y-2 pt-1">
					<div className="h-3.5 w-3/4 rounded bg-foreground/10" />
					<div className="h-3 w-full rounded bg-foreground/10" />
				</div>
			</div>
		</div>
	);
}

function ShareBody(props: ShareSheetModalProps) {
	const { metadata, loading, error, actionBusy, canNativeShare, onRetry, onNativeShare } = props;

	if (loading) return <ShareSkeleton />;

	if (error) {
		return (
			<div className="text-center py-4">
				<p className="text-sm text-rose-400 mb-4">{error}</p>
				<Button type="button" variant="secondary" onClick={onRetry}>
					Try again
				</Button>
			</div>
		);
	}

	if (!metadata) return null;

	const thumbnailUrl = metadata.imageUrl ?? metadata.author?.avatarUrl;

	const hasPreview =
		Boolean(metadata.title) ||
		Boolean(metadata.description) ||
		Boolean(thumbnailUrl) ||
		Boolean(metadata.author?.name) ||
		Boolean(metadata.author?.username);

	return (
		<>
			{hasPreview ?
				<div className="flex gap-3 p-3 mb-4 rounded-xl bg-foreground/5 border border-border/15">
					{thumbnailUrl ?
						<img
							src={thumbnailUrl}
							alt=""
							className="w-14 h-14 rounded-lg object-cover shrink-0 bg-foreground/10"
						/> :
						<div className="w-14 h-14 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0">
							<Share2 className="w-6 h-6 text-rose-500 dark:text-rose-400" aria-hidden />
						</div>}
					<div className="min-w-0 flex-1 space-y-0.5">
						{metadata.title ?
							<p className="text-sm font-semibold text-foreground truncate">{metadata.title}</p> :
							null}
						{metadata.description ?
							<p className="text-xs text-muted line-clamp-3">{metadata.description}</p> :
							null}
						{metadata.author?.name ?
							<p className="text-xs text-muted/90 truncate">{metadata.author.name}</p> :
							null}
						{metadata.author?.username ?
							<p className="text-xs text-muted/80 truncate">{metadata.author.username}</p> :
							null}
					</div>
				</div> :
				null}

			{canNativeShare && (metadata.title || metadata.description) ?
				<Button
					type="button"
					onClick={onNativeShare}
					disabled={actionBusy}
					className="w-full bg-rose-500 hover:bg-rose-600 text-white border-0"
				>
					Share…
				</Button> :
				null}
		</>
	);
}

export function ShareSheetModal(props: ShareSheetModalProps) {
	const { isOpen, onClose, variant = 'default' } = props;
	if (!isOpen) return null;

	const title = 'Share';

	if (variant === 'immersive') {
		return (
			<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
				<div
					className="absolute inset-0 bg-black/80 backdrop-blur-sm"
					onClick={onClose}
					aria-hidden
				/>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="share-sheet-title"
					className="relative w-full max-w-md bg-surface border border-border/20 rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
				>
					<div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
						<h2 id="share-sheet-title" className="text-lg font-semibold text-foreground">{title}</h2>
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
							aria-label="Close"
						>
							<X className="w-5 h-5 text-muted" />
						</button>
					</div>
					<div className="p-5">
						<ShareBody {...props} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title={title}>
			<div className="p-5">
				<ShareBody {...props} />
			</div>
		</Modal>
	);
}
