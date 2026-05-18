import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Clock, XCircle, Shield, ChevronDown } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { useAuth, useCurrentCreator } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useKycSubmit, validateKycFile, type KycDocKey } from '../../hooks/useKycSubmit';

const STEPS: { title: string, key: KycDocKey, hint: string }[] = [
	{ title: 'Government ID Front', key: 'idFront', hint: 'Clear photo of the front of your government ID' },
	{ title: 'Government ID Back', key: 'idBack', hint: 'Clear photo of the back of your government ID' },
	{ title: 'Selfie with ID', key: 'selfie', hint: 'Hold your ID next to your face in good lighting' },
];

const MAX_BYTES = 10 * 1024 * 1024;

export function KYCFlow() {
	const creator = useCurrentCreator();
	const { state: authState } = useAuth();
	const { showToast } = useNotifications();
	const navigate = useNavigate();
	const { submitApplication, submitting, error, uploadingKey, clearError } = useKycSubmit();

	const [step, setStep] = useState(0);
	const [fullName, setFullName] = useState('');
	const [dob, setDob] = useState('');
	const [address, setAddress] = useState('');
	const [showExtra, setShowExtra] = useState(false);
	const [files, setFiles] = useState<Partial<Record<KycDocKey, File>>>({});
	const [previews, setPreviews] = useState<Partial<Record<KycDocKey, string>>>({});
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const kycStatus = authState.user?.creatorDashboard?.kycStatus ?? creator?.kycStatus ?? 'not_submitted';
	const rejectionReason = creator?.kycRejectionReason?.trim();

	useEffect(() => {
		if (creator?.name && !fullName) setFullName(creator.name);
	}, [creator?.name, fullName]);

	useEffect(() => {
		return () => {
			Object.values(previews).forEach(url => {
				if (url) URL.revokeObjectURL(url);
			});
		};
	}, [previews]);

	const docStepIndex = step - 1;
	const currentDoc = docStepIndex >= 0 ? STEPS[docStepIndex] : null;

	const allDocsReady = useMemo(
		() => Boolean(files.idFront && files.idBack && files.selfie),
		[files]
	);

	function openFilePicker() {
		fileInputRef.current?.click();
	}

	function onFileSelected(file: File | null) {
		if (!file || !currentDoc) return;
		const validation = validateKycFile(file);
		if (validation) {
			showToast(validation, 'error');
			return;
		}
		setFiles(prev => ({ ...prev, [currentDoc.key]: file }));
		setPreviews(prev => {
			const old = prev[currentDoc.key];
			if (old) URL.revokeObjectURL(old);
			return { ...prev, [currentDoc.key]: URL.createObjectURL(file) };
		});
		clearError();
	}

	function handleSubmit() {
		if (!fullName.trim()) {
			showToast('Enter your legal name', 'error');
			return;
		}
		if (!allDocsReady || !files.idFront || !files.idBack || !files.selfie) {
			showToast('Please upload all required documents', 'error');
			return;
		}
		void submitApplication({
			fullName: fullName.trim(),
			idFront: files.idFront,
			idBack: files.idBack,
			selfie: files.selfie,
			dob: dob.trim() || undefined,
			address: address.trim() || undefined,
		})
			.then(() => {
				showToast('KYC submitted! Review typically takes 1–2 business days.', 'success');
			})
			.catch(() => {
				/* error surfaced via hook */
			});
	}

	if (!creator) {
		return (
			<Layout>
				<div className="max-w-lg mx-auto px-4 py-12 text-center text-muted">Loading…</div>
			</Layout>
		);
	}

	if (kycStatus === 'approved') {
		return (
			<Layout>
				<div className="max-w-lg mx-auto px-4 py-12 text-center">
					<div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<CheckCircle className="w-8 h-8 text-emerald-400" />
					</div>
					<h2 className="text-xl font-bold text-foreground mb-2">Identity Verified</h2>
					<p className="text-muted mb-6">Your account is fully verified and you can monetize your content.</p>
					<Button variant="primary" onClick={() => { void navigate('/creator-dashboard'); }}>Go to Dashboard</Button>
				</div>
			</Layout>
		);
	}

	if (kycStatus === 'pending') {
		return (
			<Layout>
				<div className="max-w-lg mx-auto px-4 py-12 text-center">
					<div className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Clock className="w-8 h-8 text-amber-400" />
					</div>
					<h2 className="text-xl font-bold text-foreground mb-2">Under Review</h2>
					<p className="text-muted mb-6">Your documents have been submitted and are being reviewed. This typically takes 1–2 business days.</p>
					<div className="bg-surface border border-border/20 rounded-2xl p-4 text-left mb-6">
						{STEPS.map(({ title }) => (
							<div key={title} className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
								<CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
								<span className="text-sm text-foreground/80">{title}</span>
								<span className="ml-auto text-xs text-emerald-400">Submitted</span>
							</div>
						))}
					</div>
					<Button variant="outline" onClick={() => { void navigate('/creator-dashboard'); }}>Back to Dashboard</Button>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,application/pdf"
				className="hidden"
				onChange={e => {
					onFileSelected(e.target.files?.[0] ?? null);
					e.target.value = '';
				}}
			/>
			<div className="max-w-lg mx-auto px-4 py-6">
				<div className="flex items-center gap-3 mb-6">
					<div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center">
						<Shield className="w-5 h-5 text-rose-400" />
					</div>
					<div>
						<h1 className="text-xl font-bold text-foreground">Identity Verification</h1>
						<p className="text-muted text-sm">Required to monetize and receive payouts</p>
					</div>
				</div>

				{kycStatus === 'rejected' && (
					<div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-4 flex gap-2">
						<XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-medium text-rose-300">Previous submission rejected</p>
							<p className="text-xs text-rose-400/70 mt-0.5">
								{rejectionReason || 'Please resubmit with clear, readable photos of your documents.'}
							</p>
						</div>
					</div>
				)}

				{error && (
					<div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-rose-300">
						{error}
					</div>
				)}

				<div className="flex gap-2 mb-6">
					{[0, 1, 2, 3].map(s => (
						<div
							key={s}
							className={`flex-1 h-1 rounded-full transition-all ${s <= step ? 'bg-rose-500' : 'bg-foreground/10'}`}
						/>
					))}
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl p-5 mb-4">
					{step === 0 ? (
						<>
							<h3 className="font-semibold text-foreground mb-1">Your details</h3>
							<p className="text-muted text-sm mb-4">Name must match your government ID</p>
							<label className="block text-xs text-muted mb-1">Legal full name</label>
							<input
								value={fullName}
								onChange={e => setFullName(e.target.value)}
								placeholder="As shown on your ID"
								className="w-full bg-input border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 mb-4"
							/>
							<button
								type="button"
								onClick={() => setShowExtra(v => !v)}
								className="flex items-center gap-1 text-xs text-muted hover:text-foreground mb-3"
							>
								<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExtra ? 'rotate-180' : ''}`} />
								Additional details (optional)
							</button>
							{showExtra && (
								<div className="space-y-3">
									<div>
										<label className="block text-xs text-muted mb-1">Date of birth</label>
										<input
											type="date"
											value={dob}
											onChange={e => setDob(e.target.value)}
											className="w-full bg-input border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
										/>
									</div>
									<div>
										<label className="block text-xs text-muted mb-1">Address</label>
										<textarea
											value={address}
											onChange={e => setAddress(e.target.value)}
											rows={2}
											placeholder="Street, city, state"
											className="w-full bg-input border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
										/>
									</div>
								</div>
							)}
						</>
					) : currentDoc ? (
						<>
							<h3 className="font-semibold text-foreground mb-1">
								Step {step}: {currentDoc.title}
							</h3>
							<p className="text-muted text-sm mb-4">{currentDoc.hint}</p>
							<button
								type="button"
								onClick={openFilePicker}
								disabled={uploadingKey === currentDoc.key}
								className={`w-full border-2 border-dashed rounded-2xl overflow-hidden transition-all ${
									files[currentDoc.key] ?
										'border-emerald-500/50 bg-emerald-500/5' :
										'border-border/20 hover:border-rose-500/30 hover:bg-foreground/5'
								}`}
							>
								{previews[currentDoc.key] && files[currentDoc.key]?.type.startsWith('image/') ? (
									<img
										src={previews[currentDoc.key]}
										alt={currentDoc.title}
										className="w-full max-h-48 object-contain bg-background/50"
									/>
								) : files[currentDoc.key] ? (
									<div className="py-10 flex flex-col items-center gap-2">
										<CheckCircle className="w-10 h-10 text-emerald-400" />
										<p className="text-emerald-400 font-medium text-sm">{files[currentDoc.key]?.name}</p>
										<p className="text-muted text-xs">Tap to replace</p>
									</div>
								) : (
									<div className="py-10 flex flex-col items-center gap-3">
										<Upload className="w-10 h-10 text-muted/60" />
										<p className="text-muted text-sm">
											{uploadingKey === currentDoc.key ? 'Uploading…' : `Tap to upload ${currentDoc.title}`}
										</p>
										<p className="text-muted/70 text-xs">JPG, PNG, WEBP, or PDF · max {(MAX_BYTES / 1024 / 1024).toFixed(0)} MB</p>
									</div>
								)}
							</button>
						</>
					) : null}
				</div>

				<div className="flex gap-2">
					{step > 0 && (
						<Button variant="outline" onClick={() => setStep(s => s - 1)}>
							Back
						</Button>
					)}
					{step < 3 ? (
						<Button
							variant="primary"
							fullWidth
							disabled={step === 0 ? !fullName.trim() : !files[currentDoc?.key ?? 'idFront']}
							onClick={() => setStep(s => s + 1)}
						>
							Continue
						</Button>
					) : (
						<Button
							variant="primary"
							fullWidth
							isLoading={submitting}
							disabled={!allDocsReady || submitting}
							onClick={() => { handleSubmit(); }}
						>
							Submit for Verification
						</Button>
					)}
				</div>
			</div>
		</Layout>
	);
}
