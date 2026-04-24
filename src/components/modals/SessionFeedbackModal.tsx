import { useState } from 'react';
import { X, Star } from '../icons';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (rating: number, comment: string) => Promise<void> | void;
	title?: string;
}

export function SessionFeedbackModal({ isOpen, onClose, onSubmit, title = 'Rate your session' }: Props) {
	const [rating, setRating] = useState(5);
	const [comment, setComment] = useState('');
	const [submitting, setSubmitting] = useState(false);

	if (!isOpen) return null;

	async function handleSubmit() {
		setSubmitting(true);
		try {
			await onSubmit(rating, comment.trim());
			onClose();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4">
			<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
			<div className="relative w-full sm:max-w-md bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up sm:animate-fade-in">
				<div className="p-5 border-b border-white/5 flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
						<Star className="w-5 h-5 text-amber-400 fill-amber-400" />
					</div>
					<div className="flex-1">
						<h2 className="text-base font-bold text-white">{title}</h2>
						<p className="text-xs text-white/40">Your feedback helps improve sessions.</p>
					</div>
					<button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 transition-colors">
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="p-5 space-y-4">
					<div>
						<p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Rating</p>
						<div className="flex gap-1">
							{[1, 2, 3, 4, 5].map(v => (
								<button
									key={v}
									type="button"
									onClick={() => setRating(v)}
									className={`flex-1 py-3 rounded-2xl border transition-all ${
										rating === v ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/8'
									}`}
								>
									{v}
								</button>
							))}
						</div>
					</div>

					<div>
						<p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Comment (optional)</p>
						<textarea
							value={comment}
							onChange={e => setComment(e.target.value)}
							rows={3}
							maxLength={500}
							className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-rose-500/30 resize-none"
							placeholder="Share what went well…"
						/>
					</div>

					<button
						type="button"
						onClick={handleSubmit}
						disabled={submitting}
						className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
					>
						{submitting ? 'Submitting…' : 'Submit feedback'}
					</button>
				</div>
			</div>
		</div>
	);
}

