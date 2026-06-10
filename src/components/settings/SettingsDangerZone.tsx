import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Loader2, LogOut, Trash2, Upload } from '../icons';
import { DeletionStatusBadge } from '../account/DeletionPageUi';
import type { DeleteAccountStatus } from '../../services/accountTypes';

function formatWhen(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DangerZoneRow({
	Icon,
	iconClassName,
	title,
	description,
	onClick,
	disabled,
	loading,
	destructive,
}: {
	Icon: ComponentType<{ className?: string }>,
	iconClassName: string,
	title: string,
	description: string,
	onClick: () => void,
	disabled?: boolean,
	loading?: boolean,
	destructive?: boolean,
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || loading}
			className={[
				'group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all',
				'disabled:opacity-50 disabled:cursor-not-allowed',
				destructive ?
					'border-red-500/20 bg-red-500/5 hover:border-red-500/35 hover:bg-red-500/10' :
					'border-border/25 bg-surface2/30 hover:border-border/40 hover:bg-foreground/5',
			].join(' ')}
		>
			<span
				className={[
					'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
					iconClassName,
				].join(' ')}
				aria-hidden
			>
				{loading ?
					<Loader2 className="h-4 w-4 animate-spin" /> :
					<Icon className="h-4 w-4" />}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-semibold text-foreground">{title}</span>
				<span className="block text-xs text-muted mt-0.5 leading-relaxed">{description}</span>
			</span>
			<ChevronRight
				className={[
					'h-4 w-4 shrink-0 text-muted/60 transition-transform',
					'group-hover:text-foreground group-hover:translate-x-0.5',
					destructive ? 'group-hover:text-red-300' : '',
				].join(' ')}
				aria-hidden
			/>
		</button>
	);
}

export function SettingsDangerZone({
	deleteStatus,
	scheduledDeleteAt,
	deleteLoading,
	onManageDeletion,
	onExport,
	onSignOut,
}: {
	deleteStatus: DeleteAccountStatus,
	scheduledDeleteAt: string | null,
	deleteLoading: boolean,
	onManageDeletion: () => void,
	onExport: () => void,
	onSignOut: () => void,
}) {
	const statusMessage: ReactNode =
		deleteStatus === 'pending_verification' ?
			'Your deletion request is waiting for a verification code. Open account deletion to enter it.' :
			deleteStatus === 'scheduled' ?
				`Your account is scheduled for deletion${scheduledDeleteAt ? ` on ${formatWhen(scheduledDeleteAt)}` : ''}.` :
				null;

	return (
		<section className="rounded-2xl border border-red-500/15 bg-gradient-to-b from-red-500/[0.06] to-surface p-5 sm:p-6 shadow-sm">
			<div className="flex items-start justify-between gap-3 mb-4">
				<div className="flex gap-3 min-w-0">
					<span
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400"
						aria-hidden
					>
						<AlertTriangle className="h-5 w-5" />
					</span>
					<div className="min-w-0">
						<h2 className="text-base font-semibold text-foreground">Privacy & account</h2>
						<p className="text-xs text-muted mt-1 leading-relaxed">
							Export your data, request deletion, or sign out of this device.
						</p>
					</div>
				</div>
				<DeletionStatusBadge status={deleteStatus} />
			</div>

			{statusMessage ? (
				<div
					role="status"
					className="mb-4 flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3.5 py-3 text-xs text-amber-100/90 leading-relaxed"
				>
					<AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden />
					<p>{statusMessage}</p>
				</div>
			) : null}

			<div className="space-y-2.5">
				<DangerZoneRow
					Icon={Trash2}
					iconClassName="bg-red-500/15 text-red-400 group-hover:bg-red-500/20"
					title="Manage account deletion"
					description={
						deleteStatus === 'none' ?
							'Start or continue the two-step deletion process' :
							deleteStatus === 'pending_verification' ?
								'Enter your verification code' :
								'View scheduled deletion details'
					}
					onClick={onManageDeletion}
					destructive
				/>
				<DangerZoneRow
					Icon={Upload}
					iconClassName="bg-foreground/8 text-muted group-hover:bg-foreground/12"
					title="Export my data"
					description="Download a copy of your account information"
					onClick={onExport}
					disabled={deleteLoading}
					loading={deleteLoading}
				/>
			</div>

			<div className="mt-4 pt-4 border-t border-red-500/10">
				<button
					type="button"
					onClick={onSignOut}
					className={
						'flex w-full items-center justify-center gap-2 rounded-xl border border-border/30 ' +
						'bg-surface2/50 px-4 py-3 text-sm font-semibold text-foreground ' +
						'hover:bg-foreground/5 hover:border-border/50 transition-colors active:scale-[0.99]'
					}
				>
					<LogOut className="h-4 w-4 text-muted" aria-hidden />
					Sign out
				</button>
			</div>
		</section>
	);
}
