import { useNavigate } from 'react-router-dom';
import { Shield } from '../icons';
import { Button } from '../ui/Button';
import type { CreatorKycStatus } from '../../types';

interface PayoutKycBannerProps {
	kycStatus: CreatorKycStatus;
}

export function PayoutKycBanner({ kycStatus }: PayoutKycBannerProps) {
	const navigate = useNavigate();

	if (kycStatus === 'approved') return null;

	const title =
		kycStatus === 'pending' ? 'KYC verification pending' :
		kycStatus === 'rejected' ? 'KYC rejected' :
		'Complete KYC to withdraw';

	const description =
		kycStatus === 'pending' ?
			'Your identity review is in progress. Withdrawals unlock once KYC is approved.' :
			kycStatus === 'rejected' ?
				'Please resubmit your documents before requesting a payout.' :
				'Verify your identity to withdraw creator earnings.';

	const cta =
		kycStatus === 'rejected' ? 'Resubmit KYC' :
		kycStatus === 'pending' ? 'View KYC status' :
		'Submit KYC';

	return (
		<div className="mb-4 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
				<Shield className="h-5 w-5 text-amber-400" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>
				<Button
					variant="secondary"
					size="sm"
					className="mt-3"
					onClick={() => { void navigate('/creator-dashboard/kyc'); }}
				>
					{cta}
				</Button>
			</div>
		</div>
	);
}
