import { useState } from 'react';
import { CheckCircle, XCircle, Eye, Clock, Shield } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer, Modal } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { useNotifications } from '../../context/NotificationContext';
import { useAdminKyc, type AdminKycTab } from '../../hooks/useAdminKyc';
import type { KYCApplication } from '../../types';
import { formatDate } from '../../utils/date';
import { apiErrorMessage } from '../../services/creatorsApi';

export function CreatorApproval() {
	const { showToast } = useNotifications();
	const [activeTab, setActiveTab] = useState<AdminKycTab>('pending');
	const {
		applications,
		loading,
		loadingMore,
		error,
		nextCursor,
		approve,
		reject,
		loadMore,
		refresh,
	} = useAdminKyc({ tab: activeTab });

	const [selectedApp, setSelectedApp] = useState<KYCApplication | null>(null);
	const [rejectReason, setRejectReason] = useState('');
	const [showRejectModal, setShowRejectModal] = useState(false);
	const [acting, setActing] = useState(false);

	function handleApprove(id: string) {
		setActing(true);
		void approve(id)
			.then(() => {
				showToast('Creator approved successfully!');
				setSelectedApp(null);
			})
			.catch(err => showToast(apiErrorMessage(err, 'Approve failed'), 'error'))
			.finally(() => setActing(false));
	}

	function handleReject() {
		if (!selectedApp || !rejectReason.trim()) {
			showToast('Please provide a rejection reason', 'error');
			return;
		}
		setActing(true);
		void reject(selectedApp.id, rejectReason.trim())
			.then(() => {
				showToast('Creator application rejected');
				setShowRejectModal(false);
				setSelectedApp(null);
				setRejectReason('');
			})
			.catch(err => showToast(apiErrorMessage(err, 'Reject failed'), 'error'))
			.finally(() => setActing(false));
	}

	const statusColors = {
		pending: 'bg-amber-500/20 text-amber-400',
		approved: 'bg-emerald-500/20 text-emerald-400',
		rejected: 'bg-rose-500/20 text-rose-400',
		not_submitted: 'bg-foreground/10 text-muted',
	};

	const pendingOnTab = applications.filter(a => a.status === 'pending').length;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-4xl mx-auto px-4 pt-20 pb-8">
				<div className="flex items-center justify-between gap-3 mb-6">
					<div className="flex items-center gap-3">
						<Shield className="w-5 h-5 text-rose-400" />
						<h1 className="text-xl font-bold text-foreground">KYC Applications</h1>
					</div>
					<button
						type="button"
						onClick={() => { void refresh(); }}
						className="text-xs text-rose-400 hover:text-rose-300"
					>
						Refresh
					</button>
				</div>

				<div className="flex gap-1 bg-foreground/5 p-0.5 rounded-xl mb-4 w-fit">
					{(['pending', 'all'] as const).map(tab => (
						<button
							key={tab}
							type="button"
							onClick={() => setActiveTab(tab)}
							className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
								activeTab === tab ? 'bg-foreground/10 text-foreground' : 'text-muted'
							}`}
						>
							{tab} {tab === 'pending' && `(${pendingOnTab})`}
						</button>
					))}
				</div>

				{error && (
					<div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
						{error}
					</div>
				)}

				<div className="space-y-3">
					{loading && applications.length === 0 ? (
						<div className="space-y-3">
							{[1, 2, 3].map(i => (
								<div key={i} className="h-24 rounded-2xl bg-foreground/5 animate-pulse" />
							))}
						</div>
					) : applications.length === 0 ? (
						<div className="text-center py-10 bg-surface border border-border/20 rounded-2xl">
							<Clock className="w-8 h-8 text-muted/50 mx-auto mb-2" />
							<p className="text-muted text-sm">No applications in this view</p>
						</div>
					) : (
						applications.map(app => (
							<div key={app.id} className="bg-surface border border-border/20 rounded-2xl p-4">
								<div className="flex items-start gap-4">
									{app.creatorAvatar ? (
										<img src={app.creatorAvatar} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
									) : (
										<div className="w-12 h-12 rounded-xl bg-foreground/10 shrink-0" />
									)}
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-2">
											<div>
												<p className="font-semibold text-foreground">{app.creatorName}</p>
												{app.creatorEmail && (
													<p className="text-xs text-muted truncate">{app.creatorEmail}</p>
												)}
											</div>
											<span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${statusColors[app.status]}`}>
												{app.status.replace('_', ' ')}
											</span>
										</div>
										<p className="text-xs text-muted mt-1">Submitted {formatDate(app.submittedAt)}</p>
										{app.rejectionReason && app.status === 'rejected' && (
											<p className="text-xs text-rose-400/80 mt-1 line-clamp-2">{app.rejectionReason}</p>
										)}
									</div>
								</div>
								<div className="flex gap-2 mt-3">
									<button
										type="button"
										onClick={() => setSelectedApp(app)}
										className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-3 py-1.5 rounded-lg border border-border/20"
									>
										<Eye className="w-3.5 h-3.5" /> Review
									</button>
									{app.status === 'pending' && (
										<>
											<button
												type="button"
												disabled={acting}
												onClick={() => handleApprove(app.id)}
												className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10"
											>
												<CheckCircle className="w-3.5 h-3.5" /> Approve
											</button>
											<button
												type="button"
												disabled={acting}
												onClick={() => { setSelectedApp(app); setShowRejectModal(true); }}
												className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10"
											>
												<XCircle className="w-3.5 h-3.5" /> Reject
											</button>
										</>
									)}
								</div>
							</div>
						))
					)}
				</div>

				{nextCursor && !loading && (
					<div className="mt-4 text-center">
						<Button variant="outline" isLoading={loadingMore} onClick={() => { void loadMore(); }}>
							Load more
						</Button>
					</div>
				)}
			</div>

			{selectedApp && !showRejectModal && (
				<Modal isOpen title="Review KYC Application" onClose={() => setSelectedApp(null)} maxWidth="max-w-lg">
					<div className="p-5 space-y-4">
						<div className="flex items-center gap-3">
							{selectedApp.creatorAvatar ? (
								<img src={selectedApp.creatorAvatar} alt="" className="w-12 h-12 rounded-xl object-cover" />
							) : (
								<div className="w-12 h-12 rounded-xl bg-foreground/10" />
							)}
							<div>
								<p className="font-semibold text-foreground">{selectedApp.creatorName}</p>
								{selectedApp.creatorEmail && (
									<p className="text-xs text-muted">{selectedApp.creatorEmail}</p>
								)}
							</div>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
							{[
								{ label: 'ID Front', url: selectedApp.idFrontUrl },
								{ label: 'ID Back', url: selectedApp.idBackUrl },
								{ label: 'Selfie', url: selectedApp.selfieUrl },
							].map(({ label, url }) => (
								<div key={label}>
									<div className="flex items-center justify-between mb-1">
										<p className="text-xs text-muted">{label}</p>
										{url && (
											<a
												href={url}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-rose-400 hover:underline"
											>
												Open
											</a>
										)}
									</div>
									{url ? (
										<img src={url} alt={label} className="w-full h-28 object-contain rounded-xl bg-background/50 border border-border/10" />
									) : (
										<div className="w-full h-28 rounded-xl bg-foreground/5 flex items-center justify-center text-xs text-muted">
											Not provided
										</div>
									)}
								</div>
							))}
						</div>
						{selectedApp.status === 'pending' && (
							<div className="flex gap-2">
								<Button variant="primary" fullWidth isLoading={acting} onClick={() => handleApprove(selectedApp.id)}>
									<CheckCircle className="w-4 h-4" /> Approve
								</Button>
								<Button variant="danger" fullWidth onClick={() => setShowRejectModal(true)}>
									<XCircle className="w-4 h-4" /> Reject
								</Button>
							</div>
						)}
					</div>
				</Modal>
			)}

			<Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Application">
				<div className="p-5">
					<p className="text-sm text-muted mb-3">Provide a reason for rejection. This will be shared with the creator.</p>
					<textarea
						value={rejectReason}
						onChange={e => setRejectReason(e.target.value)}
						placeholder="e.g., ID documents are blurry..."
						rows={3}
						className="w-full bg-input border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40 resize-none mb-3"
					/>
					<Button variant="danger" fullWidth isLoading={acting} onClick={handleReject}>
						Confirm Rejection
					</Button>
				</div>
			</Modal>
		</div>
	);
}
