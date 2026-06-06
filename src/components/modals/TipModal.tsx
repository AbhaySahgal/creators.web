import { useState } from 'react';
import { Zap, Wallet } from '../icons';
import { Modal } from '../ui/Toast';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';
import { useNotifications } from '../../context/NotificationContext';
import { formatINR } from '../../services/razorpay';
import { compareMinor, formatINRFromMinor, inrRupeesToMinor } from '../../utils/money';
import { MediaAvatar } from '../ui/MediaAvatar';

const TIP_PRESETS = [3, 5, 10, 20, 50, 100];

interface TipModalProps {
	isOpen: boolean;
	onClose: () => void;
	creatorId: string;
	creatorName: string;
	creatorAvatar: string;
	/** When set, B8 `tiplive` / POST /payments/tip/live is used instead of post `tip`. */
	liveId?: string;
	/** Called after a successful live tip with server `tip_total_minor`. */
	onLiveTipSuccess?: (tipTotalMinor: string) => void;
	/** When tipping from a post, sent to the payments API for attribution. */
	postId?: string;
}

export function TipModal({
	isOpen,
	onClose,
	creatorId,
	creatorName,
	creatorAvatar,
	liveId,
	onLiveTipSuccess,
	postId,
}: TipModalProps) {
	const { state: authState } = useAuth();
	const { tip, tipLive } = useWallet();
	const { showToast, refresh } = useNotifications();
	const [amount, setAmount] = useState<number>(10);
	const [customAmount, setCustomAmount] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState('');

	const tipAmount = customAmount ? parseFloat(customAmount) || 0 : amount;
	const balanceMinor = authState.user?.walletBalanceMinor ?? '0';
	const tipMinor = inrRupeesToMinor(tipAmount);
	const canAffordWallet = compareMinor(balanceMinor, '>=', tipMinor);
	const isLiveTip = Boolean(liveId?.trim());

	function handleSendTip() {
		if (!tipAmount || tipAmount <= 0) return;
		if (!canAffordWallet) return;
		setIsLoading(true);
		setError('');

		const amountCents = tipMinor;
		const idempotencyKey = isLiveTip ? `live-tip-${String(liveId).trim()}-${Date.now()}` : undefined;

		const promise = isLiveTip ?
			tipLive(String(liveId).trim(), amountCents, { idempotencyKey }) :
			tip(String(creatorId), amountCents, postId);

		void promise
			.then(result => {
				if (!result.ok) {
					setError(result.error || 'Tip failed.');
					return;
				}
				setSuccess(true);
				showToast(`Sent ${formatINR(tipAmount)} tip to ${creatorName}!`);
				if (isLiveTip && 'tip_total_minor' in result && typeof result.tip_total_minor === 'string') {
					onLiveTipSuccess?.(result.tip_total_minor);
				}
				void refresh({ unreadOnly: true });
				setTimeout(onClose, 1500);
			})
			.catch(err => {
				setError(err instanceof Error ? err.message : 'Tip failed.');
			})
			.finally(() => setIsLoading(false));
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title={isLiveTip ? 'Tip this live' : 'Send a Tip'}>
			<div className="p-5">
				{success ? (
					<div className="text-center py-6">
						<div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
							<Zap className="w-8 h-8 text-amber-400 fill-amber-400" />
						</div>
						<p className="text-foreground font-semibold text-lg">Tip Sent!</p>
						<p className="text-muted text-sm mt-1">{formatINR(tipAmount)} sent to {creatorName}</p>
					</div>
				) : (
					<>
						<div className="flex items-center gap-3 mb-5 p-3 bg-foreground/5 rounded-xl">
							<MediaAvatar
								src={creatorAvatar}
								alt={creatorName}
								name={creatorName}
								className="h-10 w-10 shrink-0 rounded-full"
							/>
							<div>
								<p className="text-sm font-semibold text-foreground">{creatorName}</p>
								<p className="text-xs text-muted">
									{isLiveTip ? 'Tip goes to this live stream' : 'Your tip supports their work directly'}
								</p>
							</div>
						</div>

						<p className="text-xs text-muted mb-2 font-medium">CHOOSE AMOUNT</p>
						<div className="grid grid-cols-3 gap-2 mb-3">
							{TIP_PRESETS.map(preset => (
								<button
									key={preset}
									type="button"
									onClick={() => { setAmount(preset); setCustomAmount(''); }}
									className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
										amount === preset && !customAmount ?
											'bg-amber-500 text-white' :
											'bg-foreground/5 text-muted hover:bg-foreground/10'
									}`}
								>
									{formatINR(preset)}
								</button>
							))}
						</div>
						<input
							type="number"
							value={customAmount}
							onChange={e => setCustomAmount(e.target.value)}
							placeholder="Custom amount..."
							className="w-full bg-input border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40 mb-4"
						/>

						<div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
							<Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
							<div className="min-w-0">
								<p className="text-xs font-semibold text-foreground">Pay from wallet</p>
								<p className="text-xs text-muted">Balance: {formatINRFromMinor(balanceMinor)}</p>
							</div>
						</div>

						{error && (
							<div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-3">
								<p className="text-xs text-rose-400">{error}</p>
							</div>
						)}

						<Button
							variant="primary"
							fullWidth
							isLoading={isLoading}
							onClick={() => { void handleSendTip(); }}
							disabled={tipAmount <= 0 || !canAffordWallet}
							className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
						>
							<Zap className="w-4 h-4 fill-white" />
							Send {formatINR(tipAmount)} Tip
						</Button>
						{!canAffordWallet && (
							<p className="text-center text-xs text-rose-400 mt-2">
								Insufficient balance. Add funds to your wallet first.
							</p>
						)}
					</>
				)}
			</div>
		</Modal>
	);
}
