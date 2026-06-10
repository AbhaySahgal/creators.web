import { useEffect, useState } from 'react';
import { Plus, Trash2, Star, MoreHorizontal } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { useNotifications } from '../../context/NotificationContext';
import { useCuratedTop, type CuratedTopSlotUi } from '../../hooks/useCuratedTop';
import { apiErrorMessage } from '../../services/creatorsApi';

const MAX_SLOTS = 10;

export function CuratedTop() {
	const { showToast } = useNotifications();
	const { slots, loading, saving, error, save } = useCuratedTop();
	const [draft, setDraft] = useState<CuratedTopSlotUi[]>([{ creatorUserId: '', rank: 1 }]);

	useEffect(() => {
		if (loading) return;
		setDraft(slots.length > 0 ? slots : [{ creatorUserId: '', rank: 1 }]);
	}, [loading, slots]);

	function updateRow(index: number, patch: Partial<CuratedTopSlotUi>) {
		setDraft(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	}

	function addRow() {
		if (draft.length >= MAX_SLOTS) {
			showToast(`Maximum ${MAX_SLOTS} slots`, 'error');
			return;
		}
		setDraft(prev => [...prev, { creatorUserId: '', rank: prev.length + 1 }]);
	}

	function removeRow(index: number) {
		setDraft(prev =>
			prev
				.filter((_, i) => i !== index)
				.map((row, i) => ({ ...row, rank: i + 1 }))
		);
	}

	function handleSave() {
		const cleaned = draft
			.map((row, i) => ({
				...row,
				creatorUserId: row.creatorUserId.trim(),
				rank: i + 1,
			}))
			.filter(row => row.creatorUserId.length > 0);

		if (cleaned.length === 0) {
			showToast('Add at least one creator user ID', 'error');
			return;
		}

		const ids = cleaned.map(r => r.creatorUserId);
		const dup = ids.some((id, i) => ids.indexOf(id) !== i);
		if (dup) {
			showToast('Duplicate creator IDs are not allowed', 'error');
			return;
		}

		void save(cleaned)
			.then(() => showToast('Curated top saved', 'success'))
			.catch(err => showToast(apiErrorMessage(err, 'Save failed'), 'error'));
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-2xl mx-auto px-4 pt-20 pb-8">
				<div className="flex items-center gap-3 mb-2">
					<Star className="w-5 h-5 text-amber-400" />
					<h1 className="text-xl font-bold text-foreground">Curated Top Creators</h1>
				</div>
				<p className="text-sm text-muted mb-6">
					Override algorithmic ranking on Explore when active. Enter creator user IDs in display order.
				</p>

				{error && (
					<div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
						{error}
					</div>
				)}

				{loading && draft.length === 1 && !draft[0]?.creatorUserId ? (
					<div className="space-y-3">
						{[1, 2, 3].map(i => (
							<div key={i} className="h-16 rounded-2xl bg-foreground/5 animate-pulse" />
						))}
					</div>
				) : (
					<div className="space-y-3 mb-4">
						{draft.map((row, index) => (
							<div
								key={`slot-${index}`}
								className="flex items-center gap-3 bg-surface border border-border/20 rounded-2xl p-3"
							>
								<MoreHorizontal className="w-4 h-4 text-muted/50 shrink-0" />
								<span className="text-xs font-bold text-amber-400 w-8 shrink-0">#{row.rank}</span>
								<input
									value={row.creatorUserId}
									onChange={e => updateRow(index, { creatorUserId: e.target.value })}
									placeholder="Creator user ID"
									className="flex-1 min-w-0 bg-input border border-border/20 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30"
								/>
								{row.name && (
									<span className="text-xs text-muted hidden sm:block truncate max-w-[100px]">
										{row.name}
									</span>
								)}
								<button
									type="button"
									onClick={() => removeRow(index)}
									className="p-2 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10"
									aria-label="Remove slot"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						))}
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={addRow} disabled={draft.length >= MAX_SLOTS}>
						<Plus className="w-4 h-4" /> Add slot
					</Button>
					<Button variant="primary" isLoading={saving} onClick={handleSave}>
						Save curated top
					</Button>
				</div>
			</div>
		</div>
	);
}
