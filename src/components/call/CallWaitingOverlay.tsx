import { Phone, PhoneOff } from '../icons';
import { useCall } from '../../context/CallContext';
import { useNavigate } from 'react-router-dom';

export function CallWaitingOverlay() {
	const { state, declineWaitingCall, endAndAcceptWaitingCall } = useCall();
	const navigate = useNavigate();
	const waiting = state.callWaiting;
	if (!waiting) return null;

	return (
		<div className="fixed inset-0 z-[205] flex items-end sm:items-center justify-center">
			<div className="absolute inset-0 bg-background/50 dark:bg-black/50 backdrop-blur-sm" />

			<div className="relative w-full sm:max-w-sm bg-surface dark:bg-[#141414] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up border border-border/20">
				<div className="relative px-8 pt-8 pb-9 text-center">
					<p className="text-muted dark:text-white/50 text-sm mb-1 font-medium tracking-wide uppercase">
						Call waiting
					</p>
					<h2 className="text-xl font-bold text-foreground dark:text-white mb-1">{waiting.participantName}</h2>
					<p className="text-muted/80 dark:text-white/40 text-sm">
						is calling you while you’re on another call
					</p>

					<div className="flex items-center justify-center gap-10 mt-8">
						<div className="flex flex-col items-center gap-2">
							<button
								onClick={declineWaitingCall}
								className="w-16 h-16 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center shadow-xl shadow-rose-500/30 transition-all active:scale-90"
								aria-label="Decline waiting call"
							>
								<PhoneOff className="w-7 h-7 text-white" />
							</button>
							<span className="text-xs text-muted dark:text-white/40">Decline</span>
						</div>

						<div className="flex flex-col items-center gap-2">
							<button
								onClick={() => {
									endAndAcceptWaitingCall();
									navigate('/call');
								}}
								className="w-16 h-16 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all active:scale-90"
								aria-label="End current and accept waiting call"
							>
								<Phone className="w-7 h-7 text-white" />
							</button>
							<span className="text-xs text-muted dark:text-white/40">End & accept</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
