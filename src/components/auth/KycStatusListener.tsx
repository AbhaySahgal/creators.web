import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { mapKycStatusToCreator } from '../../services/kycMap';
import type { KycStatusUpdatePush } from '../../services/kycTypes';

/** Subscribes to `user|kycstatusupdate` and refreshes session + creator profile. */
export function KycStatusListener() {
	const ws = useWs();
	const connected = useWsConnected();
	const authReady = useWsAuthReady();
	const { state, refreshMe, updateCreatorProfile } = useAuth();
	const { showToast } = useNotifications();

	useEffect(() => {
		if (!connected || !authReady || !state.isAuthenticated) return;
		if (state.user?.role !== 'creator') return;

		const off = ws.on('user', 'kycstatusupdate', (data: unknown) => {
			const payload = data as KycStatusUpdatePush;
			const status = mapKycStatusToCreator(payload?.status);
			updateCreatorProfile({
				kycStatus: status,
				isKYCVerified: status === 'approved',
				kycRejectionReason:
					status === 'rejected' && payload?.rejection_reason ?
						String(payload.rejection_reason) :
						undefined,
			});
			void refreshMe().then(() => {
				if (status === 'approved') {
					showToast('Identity verification approved!', 'success');
				} else if (status === 'rejected') {
					showToast('KYC application was rejected. Please resubmit.', 'error');
				}
			});
		});

		return off;
	}, [
		authReady,
		connected,
		refreshMe,
		showToast,
		state.isAuthenticated,
		state.user?.role,
		updateCreatorProfile,
		ws,
	]);

	return null;
}
