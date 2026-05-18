import type { ComponentType, ReactNode } from 'react';
import { ArrowLeft, Loader2 } from '../icons';

export function DeletionBackLink({
	label,
	onClick,
	className = '',
}: {
	label: string,
	onClick: () => void,
	className?: string,
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				'group inline-flex items-center gap-2 text-sm font-medium text-muted',
				'hover:text-foreground transition-colors',
				className,
			].join(' ')}
		>
			<span
				className={
					'flex h-8 w-8 items-center justify-center rounded-full border border-border/30 ' +
					'bg-surface2/80 group-hover:border-border/50 group-hover:bg-foreground/5 transition-colors'
				}
				aria-hidden
			>
				<ArrowLeft className="h-4 w-4 shrink-0" />
			</span>
			<span>{label}</span>
		</button>
	);
}

export function DeletionPageHeader({
	title,
	description,
	badge,
}: {
	title: string,
	description: string,
	badge?: ReactNode,
}) {
	return (
		<div className="flex items-start justify-between gap-4 mb-6">
			<div className="min-w-0 flex-1">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
				<p className="text-sm text-muted mt-1.5 leading-relaxed max-w-lg">{description}</p>
			</div>
			{badge ? <div className="shrink-0 pt-0.5">{badge}</div> : null}
		</div>
	);
}

export function DeletionStatusBadge({ status }: { status: string }) {
	const config =
		status === 'scheduled' ? {
			label: 'Scheduled',
			className: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
		} :
		status === 'pending_verification' ? {
			label: 'Awaiting code',
			className: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
		} :
		{
			label: 'No request',
			className: 'bg-muted/10 text-muted border-border/25',
		};

	return (
		<span
			className={[
				'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
				config.className,
			].join(' ')}
		>
			{config.label}
		</span>
	);
}

export function DeletionStateCard({
	Icon,
	iconClassName,
	title,
	description,
	children,
	borderClassName = 'border-border/20',
}: {
	Icon: ComponentType<{ className?: string }>,
	iconClassName: string,
	title: string,
	description: ReactNode,
	children?: ReactNode,
	borderClassName?: string,
}) {
	return (
		<section
			className={[
				'rounded-2xl border bg-surface p-5 sm:p-6 shadow-sm',
				borderClassName,
			].join(' ')}
		>
			<div className="flex gap-4">
				<div
					className={[
						'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
						iconClassName,
					].join(' ')}
					aria-hidden
				>
					<Icon className="h-5 w-5" />
				</div>
				<div className="min-w-0 flex-1 space-y-4">
					<div>
						<h2 className="text-base font-semibold text-foreground">{title}</h2>
						<p className="text-sm text-muted mt-1.5 leading-relaxed">{description}</p>
					</div>
					{children}
				</div>
			</div>
		</section>
	);
}

export function DeletionInfoCallout({
	Icon,
	children,
	tone = 'neutral',
	className = '',
}: {
	Icon: ComponentType<{ className?: string }>,
	children: ReactNode,
	tone?: 'neutral' | 'warning' | 'danger',
	className?: string,
}) {
	const toneClass =
		tone === 'danger' ? 'border-rose-500/20 bg-rose-500/8 text-rose-200/90' :
		tone === 'warning' ? 'border-amber-500/20 bg-amber-500/8 text-amber-100/90' :
		'border-border/25 bg-surface2/60 text-muted';

	return (
		<div className={['flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', toneClass, className].join(' ')}>
			<Icon className="h-4 w-4 shrink-0 mt-0.5 opacity-80" aria-hidden />
			<div>{children}</div>
		</div>
	);
}

export function DeletionLoadingCard() {
	return (
		<div className="rounded-2xl border border-border/20 bg-surface p-8 flex flex-col items-center justify-center gap-3">
			<Loader2 className="h-6 w-6 text-rose-400 animate-spin" aria-hidden />
			<p className="text-sm text-muted">Loading account status…</p>
		</div>
	);
}

export function DeletionErrorBanner({ message }: { message: string }) {
	return (
		<div
			role="alert"
			className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
		>
			{message}
		</div>
	);
}
