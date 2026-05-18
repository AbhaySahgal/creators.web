import { useEffect, useState } from 'react';
import { Modal } from '../ui/Toast';
import { Button } from '../ui/Button';
import { useStreamGuidelines } from '../../hooks/useStreamGuidelines';
import type { StreamGuidelinesResponse } from '../../services/accountTypes';

interface StreamGuidelinesModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** When true, user must accept before closing (go-live gate). */
	requireAccept?: boolean;
	onAccepted?: () => void;
}

export function StreamGuidelinesModal({
	isOpen,
	onClose,
	requireAccept = false,
	onAccepted,
}: StreamGuidelinesModalProps) {
	const { fetchGuidelines, acceptGuidelines, formatError } = useStreamGuidelines();
	const [guidelines, setGuidelines] = useState<StreamGuidelinesResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [accepting, setAccepting] = useState(false);
	const [agreed, setAgreed] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!isOpen) {
			setAgreed(false);
			setError('');
			return;
		}
		setLoading(true);
		setError('');
		void fetchGuidelines()
			.then(setGuidelines)
			.catch((e: unknown) => {
				setError(formatError(e, 'Could not load stream guidelines'));
				setGuidelines(null);
			})
			.finally(() => setLoading(false));
	}, [isOpen, fetchGuidelines, formatError]);

	function handleAccept() {
		if (!agreed) return;
		setAccepting(true);
		setError('');
		void acceptGuidelines()
			.then(() => {
				onAccepted?.();
				onClose();
			})
			.catch((e: unknown) => {
				setError(formatError(e, 'Could not accept guidelines'));
			})
			.finally(() => setAccepting(false));
	}

	function handleClose() {
		if (requireAccept) return;
		onClose();
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Stream guidelines"
			maxWidth="max-w-lg"
		>
			<div className="px-5 py-4 space-y-4">
				{loading && (
					<p className="text-sm text-muted py-6 text-center">Loading guidelines…</p>
				)}
				{!loading && guidelines && (
					<>
						<div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/20 bg-surface2/50 px-4 py-3">
							<pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
								{guidelines.body}
							</pre>
						</div>
						<p className="text-xs text-muted">
							Version {guidelines.version}
							{guidelines.key ? ` · ${guidelines.key}` : ''}
						</p>
					</>
				)}
				{error && (
					<p className="text-sm text-rose-400">{error}</p>
				)}
				<label className="flex items-start gap-2 text-sm text-foreground/90 cursor-pointer select-none">
					<input
						type="checkbox"
						checked={agreed}
						onChange={e => setAgreed(e.target.checked)}
						className="mt-0.5"
					/>
					<span>I have read and agree to the stream guidelines</span>
				</label>
				<div className="flex gap-3 pt-1">
					{!requireAccept && (
						<Button variant="outline" fullWidth onClick={onClose} disabled={accepting}>
							Close
						</Button>
					)}
					<Button
						fullWidth
						disabled={!agreed || accepting || loading}
						isLoading={accepting}
						onClick={handleAccept}
					>
						Accept guidelines
					</Button>
				</div>
			</div>
		</Modal>
	);
}
