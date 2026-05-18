import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Lock, Mail } from '../components/icons';
import {
	DeletionBackLink,
	DeletionErrorBanner,
	DeletionInfoCallout,
	DeletionPageHeader,
} from '../components/account/DeletionPageUi';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useNotifications } from '../context/NotificationContext';
import {
	getStoredDeleteVerifyExpiresAt,
	useAccountDeletion,
} from '../hooks/useAccountDeletion';

type VerifyLocationState = {
	expiresAt?: string,
};

function formatWhen(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function DeleteAccountVerifyPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { showToast } = useNotifications();
	const st = (location.state ?? {}) as VerifyLocationState;
	const expiresAt = st.expiresAt ?? getStoredDeleteVerifyExpiresAt();
	const [code, setCode] = useState('');
	const { loading, error, verifyDeletion } = useAccountDeletion();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!code.trim()) return;
		void verifyDeletion(code)
			.then(() => {
				showToast('Account deletion scheduled.');
				void navigate('/delete-account', { replace: true });
			})
			.catch(() => {
				/* inline error */
			});
	}

	return (
		<Layout>
			<div className="max-w-md mx-auto px-4 py-6 sm:py-8">
				<DeletionBackLink
					label="Account deletion"
					onClick={() => { void navigate('/delete-account'); }}
					className="mb-6"
				/>

				<DeletionPageHeader
					title="Verify deletion"
					description="Enter the one-time code we sent to your account email to schedule permanent deletion."
				/>

				{expiresAt ? (
					<DeletionInfoCallout Icon={Clock} tone="warning" className="mb-4">
						<span className="font-medium text-foreground/90">Code expires</span>
						{' '}
						{formatWhen(expiresAt)}.
					</DeletionInfoCallout>
				) : null}

				<DeletionInfoCallout Icon={Mail} className="mb-6">
					Check your inbox and spam folder for the verification email. The code is not shown in this app.
				</DeletionInfoCallout>

				{error ? <DeletionErrorBanner message={error} /> : null}

				<form
					onSubmit={handleSubmit}
					className="rounded-2xl border border-border/20 bg-surface p-5 sm:p-6 shadow-sm space-y-5"
				>
					<div className="space-y-2">
						<label htmlFor="delete-verify-code" className="text-xs font-semibold uppercase tracking-wide text-muted">
							Verification code
						</label>
						<div className="relative">
							<Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" aria-hidden />
							<input
								id="delete-verify-code"
								type="text"
								inputMode="text"
								required
								autoComplete="one-time-code"
								value={code}
								onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
								placeholder="000000"
								className={
									'w-full rounded-xl bg-input border border-border/20 pl-11 pr-4 py-3.5 ' +
									'text-center text-lg font-semibold tracking-[0.35em] text-foreground ' +
									'placeholder:text-muted/40 placeholder:tracking-normal placeholder:font-normal placeholder:text-base ' +
									'focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/40'
								}
							/>
						</div>
						<p className="text-xs text-muted text-center">
							Enter the code exactly as received in your email.
						</p>
					</div>

					<Button
						type="submit"
						fullWidth
						size="lg"
						disabled={loading || !code.trim()}
						isLoading={loading}
					>
						Confirm deletion
					</Button>
				</form>
			</div>
		</Layout>
	);
}
