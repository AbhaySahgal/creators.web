import { useCallback, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useWs, useWsAuthReady } from '../context/WsContext';
import {
	fetchShareMetadata,
	nativeShare,
	recordShareEvent,
	shareErrorMessage,
} from '../services/shareService';
import type { ShareMetadata, ShareTargetType } from '../services/shareTypes';

export type ShareSheetVariant = 'default' | 'immersive';

export interface OpenShareOpts {
	type: ShareTargetType;
	targetId: string;
	variant?: ShareSheetVariant;
}

export function useShareSheet() {
	const ws = useWs();
	const wsAuthReady = useWsAuthReady();
	const { showToast } = useNotifications();

	const [isOpen, setIsOpen] = useState(false);
	const [variant, setVariant] = useState<ShareSheetVariant>('default');
	const [targetType, setTargetType] = useState<ShareTargetType>('post');
	const [targetId, setTargetId] = useState('');
	const [metadata, setMetadata] = useState<ShareMetadata | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [actionBusy, setActionBusy] = useState(false);

	const canNativeShare =
		typeof navigator !== 'undefined' &&
		typeof navigator.share === 'function';

	const load = useCallback(
		(type: ShareTargetType, id: string) => {
			setLoading(true);
			setError('');
			setMetadata(null);
			void fetchShareMetadata(type, id, { ws, wsAuthReady })
				.then(meta => setMetadata(meta))
				.catch(err => {
					setError(shareErrorMessage(err, 'Could not load share details'));
				})
				.finally(() => setLoading(false));
		},
		[ws, wsAuthReady]
	);

	const openShare = useCallback(
		(opts: OpenShareOpts) => {
			setTargetType(opts.type);
			setTargetId(opts.targetId);
			setVariant(opts.variant ?? 'default');
			setIsOpen(true);
			load(opts.type, opts.targetId);
		},
		[load]
	);

	const close = useCallback(() => {
		setIsOpen(false);
		setError('');
		setActionBusy(false);
	}, []);

	const retry = useCallback(() => {
		if (!targetId) return;
		load(targetType, targetId);
	}, [load, targetType, targetId]);

	const handleNativeShare = useCallback(() => {
		if (!metadata || actionBusy) return;
		setActionBusy(true);
		void nativeShare(metadata)
			.then(ok => {
				if (ok) {
					void recordShareEvent(metadata.type, metadata.id, 'native', { ws, wsAuthReady });
					close();
				}
			})
			.catch(err => {
				showToast(shareErrorMessage(err, 'Share failed'), 'error');
			})
			.finally(() => setActionBusy(false));
	}, [metadata, actionBusy, ws, wsAuthReady, showToast, close]);

	return {
		openShare,
		shareSheetProps: {
			isOpen,
			onClose: close,
			variant,
			targetType,
			metadata,
			loading,
			error,
			actionBusy,
			canNativeShare,
			onRetry: retry,
			onNativeShare: handleNativeShare,
		},
	};
}
