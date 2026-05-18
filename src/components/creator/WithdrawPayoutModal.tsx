import { useState } from 'react';
import { CheckCircle } from '../icons';
import { Modal } from '../ui/Toast';
import { Button } from '../ui/Button';
import { apiErrorMessage } from '../../services/creatorsApi';
import { formatINR } from '../../services/razorpay';
import { compareMinor, formatINRFromMinor, inrRupeesToMinor, parseMinor } from '../../utils/money';
import type { PayoutBalance, PayoutWithdrawResult } from '../../services/payoutTypes';

interface WithdrawPayoutModalProps {
	isOpen: boolean;
	onClose: () => void;
	balance: PayoutBalance | null;
	withdrawing: boolean;
	canWithdraw: boolean;
	onWithdraw: (amountCents: string) => Promise<PayoutWithdrawResult>;
}

export function WithdrawPayoutModal({
	isOpen,
	onClose,
	balance,
	withdrawing,
	canWithdraw,
	onWithdraw,
}: WithdrawPayoutModalProps) {
	const [amountRupees, setAmountRupees] = useState('');
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [success, setSuccess] = useState<PayoutWithdrawResult | null>(null);

	const availableMinor = balance?.availableCents ?? '0';
	const maxRupees = Number(parseMinor(availableMinor)) / 100;

	function handleClose() {
		setAmountRupees('');
		setFieldError(null);
		setSuccess(null);
		onClose();
	}

	function handleSubmit() {
		setFieldError(null);
		const rupees = Number(amountRupees);
		if (!Number.isFinite(rupees) || rupees <= 0) {
			setFieldError('Enter a valid amount');
			return;
		}
		const amountCents = inrRupeesToMinor(rupees);
		if (!compareMinor(amountCents, '<=', availableMinor)) {
			setFieldError('Amount exceeds available balance');
			return;
		}
		void onWithdraw(amountCents)
			.then(result => { setSuccess(result); })
			.catch(e => { setFieldError(apiErrorMessage(e, 'Withdrawal failed')); });
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Withdraw earnings">
			<div className="p-5">
				{success ? (
					<div className="py-8 text-center">
						<div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
							<CheckCircle className="h-8 w-8 text-emerald-400" />
						</div>
						<p className="text-lg font-semibold text-foreground">Withdrawal requested</p>
						<p className="mt-1 text-sm text-muted">
							Status: <span className="font-medium capitalize text-foreground">{success.status}</span>
						</p>
						{success.withdrawalId && (
							<p className="mt-2 text-xs text-muted">
								Reference: <span className="font-mono text-foreground/80">{success.withdrawalId}</span>
							</p>
						)}
						<p className="mt-3 text-xs text-muted/90">
							Your request is processing. Pending amounts update when the provider settles payouts.
						</p>
						<Button variant="primary" fullWidth className="mt-6" onClick={handleClose}>
							Done
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex justify-between rounded-xl bg-foreground/5 p-3">
							<span className="text-sm text-muted">Available</span>
							<span className="text-sm font-bold text-emerald-400 tabular-nums">
								{formatINRFromMinor(availableMinor)}
							</span>
						</div>
						<div>
							<label className="mb-1.5 block text-sm text-muted">Amount (INR)</label>
							<input
								type="number"
								min={0}
								step="0.01"
								max={maxRupees > 0 ? maxRupees : undefined}
								value={amountRupees}
								onChange={e => {
									setAmountRupees(e.target.value);
									setFieldError(null);
								}}
								disabled={!canWithdraw || withdrawing}
								placeholder="0.00"
								className="w-full rounded-xl border border-border/20 bg-input px-4 py-2.5 text-sm text-foreground focus:border-ring/40 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
							/>
							{maxRupees > 0 && (
								<button
									type="button"
									className="mt-1.5 text-xs font-medium text-rose-400 hover:text-rose-300"
									disabled={!canWithdraw || withdrawing}
									onClick={() => setAmountRupees(String(maxRupees))}
								>
									Withdraw full balance
								</button>
							)}
							{fieldError && <p className="mt-1.5 text-xs text-rose-400">{fieldError}</p>}
						</div>
						<Button
							variant="primary"
							fullWidth
							isLoading={withdrawing}
							disabled={!canWithdraw || withdrawing || compareMinor(availableMinor, '<=', '0')}
							onClick={() => { void handleSubmit(); }}
						>
							Withdraw {formatINR(Number(amountRupees) || 0)}
						</Button>
						{!canWithdraw && (
							<p className="text-center text-xs text-muted">
								Complete KYC approval to withdraw earnings.
							</p>
						)}
					</div>
				)}
			</div>
		</Modal>
	);
}
