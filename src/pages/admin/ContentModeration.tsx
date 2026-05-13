import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Eye } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer, Modal } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { useNotifications } from '../../context/NotificationContext';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { adminDismissReport, adminListReports, adminResolveReport } from '../../services/adminWs';
import type { AdminReportRow, AdminReportTargetPost, AdminResolveAction } from '../../services/adminWsTypes';
import { formatDate } from '../../utils/date';
import { humanizeWsBackendError } from '../../utils/wsBackendError';

const RESOLVE_ACTIONS: { value: AdminResolveAction; label: string }[] = [
	{ value: 'content_removed', label: 'Content removed' },
	{ value: 'user_warned', label: 'User warned' },
	{ value: 'user_suspended', label: 'User suspended' },
	{ value: 'user_banned', label: 'User banned' },
	{ value: 'no_action', label: 'No action' },
];

function isPostTarget(t: unknown): t is AdminReportTargetPost {
	return typeof t === 'object' && t != null && (t as { type?: string }).type === 'post';
}

export function ContentModeration() {
	const { showToast } = useNotifications();
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();

	const [reports, setReports] = useState<AdminReportRow[]>([]);
	const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('pending');
	const [targetMode, setTargetMode] = useState<'target' | 'none'>('target');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [pendingCount, setPendingCount] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [selectedReport, setSelectedReport] = useState<AdminReportRow | null>(null);
	const [resolveModalOpen, setResolveModalOpen] = useState(false);
	const [dismissModalOpen, setDismissModalOpen] = useState(false);
	const [resolveAction, setResolveAction] = useState<AdminResolveAction>('content_removed');
	const [resolveNote, setResolveNote] = useState('');
	const [dismissNote, setDismissNote] = useState('');

	const load = useCallback(async (cursor: string | null, append: boolean) => {
		if (!wsConnected) {
			setError('Not connected');
			setLoading(false);
			return;
		}
		try {
			await ensureWsAuth();
			if (append) setLoadingMore(true);
			else setLoading(true);
			setError(null);
			const res = await adminListReports(ws, {
				status: statusFilter,
				target: targetMode,
				limit: 30,
				cursor: cursor || undefined,
			});
			setReports(prev => append ? [...prev, ...res.items] : res.items);
			setNextCursor(res.nextCursor ?? null);
			if (typeof res.pendingCount === 'number') setPendingCount(res.pendingCount);
		} catch (e) {
			const msg = humanizeWsBackendError(e instanceof Error ? e.message : 'Failed to load reports');
			setError(msg);
			showToast(msg, 'error');
			if (!append) setReports([]);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	}, [ensureWsAuth, showToast, statusFilter, targetMode, ws, wsConnected]);

	useEffect(() => {
		if (!wsAuthReady && wsConnected) return;
		if (!wsConnected) {
			setLoading(false);
			setError('WebSocket disconnected');
			return;
		}
		void load(null, false);
	}, [load, statusFilter, targetMode, wsAuthReady, wsConnected]);

	function openResolve(r: AdminReportRow) {
		setSelectedReport(r);
		setResolveAction('content_removed');
		setResolveNote('');
		setResolveModalOpen(true);
	}

	function openDismiss(r: AdminReportRow) {
		setSelectedReport(r);
		setDismissNote('');
		setDismissModalOpen(true);
	}

	async function submitResolve() {
		if (!selectedReport) return;
		try {
			await ensureWsAuth();
			await adminResolveReport(ws, selectedReport.id, resolveAction, resolveNote.trim() || undefined);
			showToast('Report resolved');
			setResolveModalOpen(false);
			setSelectedReport(null);
			void load(null, false);
		} catch (e) {
			const msg = humanizeWsBackendError(e instanceof Error ? e.message : 'Resolve failed');
			showToast(msg, 'error');
		}
	}

	async function submitDismiss() {
		if (!selectedReport) return;
		try {
			await ensureWsAuth();
			await adminDismissReport(ws, selectedReport.id, dismissNote.trim() || undefined);
			showToast('Report dismissed');
			setDismissModalOpen(false);
			setSelectedReport(null);
			void load(null, false);
		} catch (e) {
			const msg = humanizeWsBackendError(e instanceof Error ? e.message : 'Dismiss failed');
			showToast(msg, 'error');
		}
	}

	const targetPreview = selectedReport?.target;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-4xl mx-auto px-4 pt-20 pb-8">
				<div className="flex items-center gap-3 mb-6">
					<AlertTriangle className="w-5 h-5 text-amber-400" />
					<h1 className="text-xl font-bold text-foreground">Content Moderation</h1>
				</div>

				{error && !loading && (
					<div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
						{error}
					</div>
				)}

				<div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
					<div className="flex gap-1 bg-foreground/5 p-0.5 rounded-xl w-fit">
						{(['pending', 'resolved', 'dismissed', 'all'] as const).map(f => (
							<button
								key={f}
								type="button"
								onClick={() => setStatusFilter(f)}
								className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
									statusFilter === f ? 'bg-foreground/10 text-foreground' : 'text-muted'
								}`}
							>
								{f}
								{f === 'pending' && pendingCount != null ? ` (${pendingCount})` : ''}
							</button>
						))}
					</div>
					<div className="flex gap-1 bg-foreground/5 p-0.5 rounded-xl w-fit">
						{(['target', 'none'] as const).map(t => (
							<button
								key={t}
								type="button"
								onClick={() => setTargetMode(t)}
								className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
									targetMode === t ? 'bg-foreground/10 text-foreground' : 'text-muted'
								}`}
							>
								{t === 'target' ? 'With target preview' : 'Target off'}
							</button>
						))}
					</div>
				</div>

				<div className="space-y-3">
					{loading && reports.length === 0 ? (
						<div className="text-center py-10 bg-surface border border-border/20 rounded-2xl text-muted text-sm">
							Loading reports…
						</div>
					) : reports.length === 0 ? (
						<div className="text-center py-10 bg-surface border border-border/20 rounded-2xl">
							<CheckCircle className="w-8 h-8 text-muted/50 mx-auto mb-2" />
							<p className="text-muted text-sm">No reports in this category</p>
						</div>
					) : (
						reports.map(report => {
							const st = report.status ?? 'pending';
							return (
								<div key={report.id} className="bg-surface border border-border/20 rounded-2xl p-4">
									<div className="flex items-start justify-between gap-3 mb-3">
										<div>
											<div className="flex items-center gap-2 mb-1">
												<span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
													st === 'pending' ? 'bg-amber-500/20 text-amber-400' :
													st === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
													'bg-foreground/10 text-muted'
												}`}
												>
													{st}
												</span>
												<span className="text-[10px] bg-foreground/5 text-muted px-2 py-0.5 rounded-full capitalize">
													{report.targetType ?? '—'}
												</span>
											</div>
											<p className="text-sm font-semibold text-foreground">{report.reason ?? 'Report'}</p>
											<p className="text-xs text-muted mt-0.5">
												Reported by {report.reporterName ?? '—'}
												{report.createdAt ? ` · ${formatDate(report.createdAt)}` : ''}
											</p>
										</div>
									</div>
									<p className="text-xs text-foreground/80 bg-foreground/5 rounded-xl px-3 py-2 mb-3">{report.description ?? '—'}</p>
									{st === 'pending' && (
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => setSelectedReport(report)}
												className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 hover:bg-foreground/10 text-muted hover:text-foreground text-xs py-2 rounded-xl transition-colors"
											>
												<Eye className="w-3.5 h-3.5" /> View
											</button>
											<button
												type="button"
												onClick={() => openResolve(report)}
												className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs py-2 rounded-xl transition-colors"
											>
												<CheckCircle className="w-3.5 h-3.5" /> Resolve
											</button>
											<button
												type="button"
												onClick={() => openDismiss(report)}
												className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 hover:bg-foreground/10 text-muted text-xs py-2 rounded-xl transition-colors"
											>
												<XCircle className="w-3.5 h-3.5" /> Dismiss
											</button>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>

				{nextCursor && (
					<div className="mt-4 flex justify-center">
						<button
							type="button"
							disabled={loadingMore}
							onClick={() => void load(nextCursor, true)}
							className="px-4 py-2 text-sm font-medium rounded-xl bg-foreground/10 text-foreground hover:bg-foreground/15 disabled:opacity-50"
						>
							{loadingMore ? 'Loading…' : 'Load more'}
						</button>
					</div>
				)}
			</div>

			{selectedReport && !resolveModalOpen && !dismissModalOpen && (
				<Modal isOpen onClose={() => setSelectedReport(null)} title="Report Details" maxWidth="max-w-lg">
					<div className="p-5 space-y-4">
						<div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
							<p className="text-sm font-semibold text-amber-300">{selectedReport.reason ?? 'Report'}</p>
							<p className="text-xs text-amber-400/70 mt-1">{selectedReport.description ?? ''}</p>
						</div>
						{isPostTarget(targetPreview) && (
							<div className="bg-foreground/5 rounded-xl p-3">
								<p className="text-xs text-muted mb-2">Reported content (post)</p>
								{targetPreview.mediaUrl && (
									<img src={targetPreview.mediaUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-2" decoding="async" />
								)}
								{targetPreview.text && (
									<p className="text-xs text-foreground/80 line-clamp-4">{targetPreview.text}</p>
								)}
								{targetPreview.creatorName && (
									<p className="text-xs text-muted/80 mt-1">By {targetPreview.creatorName}</p>
								)}
							</div>
						)}
						{targetPreview && typeof targetPreview === 'object' && (targetPreview as { type?: string }).type === 'user' && (
							<div className="bg-foreground/5 rounded-xl p-3 flex items-center gap-3">
								{(targetPreview as { avatar?: string }).avatar && (
									<img src={(targetPreview as { avatar?: string }).avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
								)}
								<div>
									<p className="text-xs text-muted">User</p>
									<p className="text-sm font-medium text-foreground">{(targetPreview as { username?: string }).username ?? '—'}</p>
								</div>
							</div>
						)}
						{targetPreview && typeof targetPreview === 'object' && (targetPreview as { type?: string }).type === 'message' && (
							<div className="bg-foreground/5 rounded-xl p-3 text-xs text-foreground/80">
								Message target (see full payload in admin tools if needed).
							</div>
						)}
						{selectedReport.status === 'pending' && (
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => { openResolve(selectedReport); }}
									className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-sm font-medium transition-colors"
								>
									<CheckCircle className="w-4 h-4" /> Resolve
								</button>
								<button
									type="button"
									onClick={() => { openDismiss(selectedReport); }}
									className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 hover:bg-foreground/10 text-muted py-2.5 rounded-xl text-sm font-medium transition-colors"
								>
									<XCircle className="w-4 h-4" /> Dismiss
								</button>
							</div>
						)}
					</div>
				</Modal>
			)}

			<Modal isOpen={resolveModalOpen} onClose={() => { setResolveModalOpen(false); setSelectedReport(null); }} title="Resolve report">
				<div className="p-5 space-y-3">
					<label className="block text-xs text-muted">Action taken</label>
					<select
						value={resolveAction}
						onChange={e => setResolveAction(e.target.value as AdminResolveAction)}
						className="w-full bg-input border border-border/20 rounded-xl px-3 py-2 text-sm text-foreground"
					>
						{RESOLVE_ACTIONS.map(a => (
							<option key={a.value} value={a.value}>{a.label}</option>
						))}
					</select>
					<label className="block text-xs text-muted">Note (optional)</label>
					<textarea
						value={resolveNote}
						onChange={e => setResolveNote(e.target.value)}
						rows={2}
						className="w-full bg-input border border-border/20 rounded-xl px-3 py-2 text-sm text-foreground resize-none"
						placeholder="Internal note…"
					/>
					<Button variant="primary" fullWidth onClick={() => void submitResolve()}>
						Submit resolution
					</Button>
				</div>
			</Modal>

			<Modal isOpen={dismissModalOpen} onClose={() => { setDismissModalOpen(false); setSelectedReport(null); }} title="Dismiss report">
				<div className="p-5 space-y-3">
					<p className="text-sm text-muted">Optional note (e.g. duplicate report).</p>
					<textarea
						value={dismissNote}
						onChange={e => setDismissNote(e.target.value)}
						rows={2}
						className="w-full bg-input border border-border/20 rounded-xl px-3 py-2 text-sm text-foreground resize-none"
					/>
					<Button variant="danger" fullWidth onClick={() => void submitDismiss()}>
						Dismiss
					</Button>
				</div>
			</Modal>
		</div>
	);
}
