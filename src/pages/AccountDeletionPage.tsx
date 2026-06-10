import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	Clock,
	Mail,
	Shield,
	Trash2,
	Upload,
} from '../components/icons';
import {
	DeletionBackLink,
	DeletionErrorBanner,
	DeletionLoadingCard,
	DeletionPageHeader,
	DeletionStateCard,
	DeletionStatusBadge,
} from '../components/account/DeletionPageUi';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
	getStoredDeleteVerifyExpiresAt,
	useAccountDeletion,
} from '../hooks/useAccountDeletion';

function formatWhen(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function AccountDeletionPage() {
	const navigate = useNavigate();
	const { state: authState } = useAuth();
	const { showToast } = useNotifications();
	const user = authState.user;
	const {
		status,
		scheduledDeleteAt,
		loading,
		error,
		refreshStatus,
		requestDeletion,
		exportData,
	} = useAccountDeletion();

	const roleLabel = user?.role === 'creator' ? 'creator account' : user?.role === 'fan' ? 'fan account' : 'account';
	const verifyExpiresAt = getStoredDeleteVerifyExpiresAt();
	const initialLoad = loading && status === 'none' && !error;

	const refreshStatusRef = useRef(refreshStatus);
	refreshStatusRef.current = refreshStatus;
	useEffect(() => {
		void refreshStatusRef.current();
	}, []);

	function handleRequest() {
		void requestDeletion()
			.then(res => {
				showToast('Deletion requested. Check your email for the verification code.');
				if (res.expiresAt) {
					void navigate('/delete-account/verify', {
						state: { expiresAt: res.expiresAt },
					});
				}
			})
			.catch(() => {
				/* inline error */
			});
	}

	function handleExport() {
		void exportData()
			.then(res => {
				showToast(`Export started (job ${res.jobId})`);
			})
			.catch(() => {
				/* inline error */
			});
	}

	return (
		<Layout>
			<div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
				<DeletionBackLink
					label="Settings"
					onClick={() => { void navigate('/settings'); }}
					className="mb-6"
				/>

				<DeletionPageHeader
					title="Account deletion"
					description={`Manage permanent deletion for your ${roleLabel}. Export your data anytime before the account is removed.`}
					badge={<DeletionStatusBadge status={status} />}
				/>

				{error ? <DeletionErrorBanner message={error} /> : null}

				<div className="space-y-4">
					{initialLoad ? <DeletionLoadingCard /> : null}

					{!initialLoad && status === 'scheduled' ? (
						<DeletionStateCard
							Icon={Clock}
							iconClassName="bg-amber-500/15 text-amber-400"
							borderClassName="border-amber-500/20"
							title="Deletion scheduled"
							description={
								<>
									Your account will be permanently deleted
									{scheduledDeleteAt ? ` on ${formatWhen(scheduledDeleteAt)}` : ' soon'}.
									You can continue using the app until then.
								</>
							}
						>
							<div className="flex flex-col sm:flex-row gap-2">
								<Button variant="outline" onClick={() => { void navigate('/settings'); }}>
									Return to settings
								</Button>
								<Button variant="outline" disabled={loading} isLoading={loading} onClick={handleExport} leftIcon={<Upload className="w-4 h-4" />}>
									Export my data
								</Button>
							</div>
						</DeletionStateCard>
					) : null}

					{!initialLoad && status === 'pending_verification' ? (
						<DeletionStateCard
							Icon={Mail}
							iconClassName="bg-rose-500/15 text-rose-400"
							borderClassName="border-rose-500/20"
							title="Verification required"
							description={
								<>
									We sent a verification code to your account email. Enter it to schedule deletion.
									{verifyExpiresAt ? (
										<span className="block mt-2 text-xs text-muted">
											Code expires {formatWhen(verifyExpiresAt)}.
										</span>
									) : null}
								</>
							}
						>
							<div className="flex flex-col sm:flex-row gap-2">
								<Button
									variant="primary"
									onClick={() => {
										void navigate('/delete-account/verify', {
											state: verifyExpiresAt ? { expiresAt: verifyExpiresAt } : undefined,
										});
									}}
								>
									Enter verification code
								</Button>
								<Button variant="outline" disabled={loading} onClick={handleExport} leftIcon={<Upload className="w-4 h-4" />}>
									Export my data
								</Button>
							</div>
						</DeletionStateCard>
					) : null}

					{!initialLoad && status === 'none' ? (
						<>
							<DeletionStateCard
								Icon={Trash2}
								iconClassName="bg-red-500/15 text-red-400"
								borderClassName="border-red-500/20"
								title="Request permanent deletion"
								description="This starts a secure two-step process. You will receive a verification code to confirm the request."
							>
								<Button
									variant="danger"
									disabled={loading}
									isLoading={loading}
									onClick={handleRequest}
									leftIcon={<Trash2 className="w-4 h-4" />}
								>
									Request account deletion
								</Button>
							</DeletionStateCard>

							<DeletionStateCard
								Icon={Shield}
								iconClassName="bg-foreground/8 text-muted"
								title="Export your data"
								description="Download a copy of your account data before you delete. You will receive a job ID when the export starts."
							>
								<Button
									variant="outline"
									disabled={loading}
									isLoading={loading}
									onClick={handleExport}
									leftIcon={<Upload className="w-4 h-4" />}
								>
									Export my data
								</Button>
							</DeletionStateCard>

							<div className="flex gap-3 rounded-xl border border-border/20 bg-surface2/40 px-4 py-3 text-sm text-muted">
								<AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden />
								<p className="leading-relaxed">
									Deletion is irreversible after verification. Make sure you have exported anything you need to keep.
								</p>
							</div>
						</>
					) : null}
				</div>
			</div>
		</Layout>
	);
}
