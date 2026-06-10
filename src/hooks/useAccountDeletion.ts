import { useCallback, useState } from 'react';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';
import type { DeleteAccountStatus, DeleteStatusResponse } from '../services/accountTypes';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import {
	userWsDeleteRequest,
	userWsDeleteStatus,
	userWsDeleteVerify,
	userWsExport,
} from '../services/userWsService';

const VERIFY_EXPIRES_KEY = 'cw_delete_verify_expires_at';

export function getStoredDeleteVerifyExpiresAt(): string | null {
	try {
		return sessionStorage.getItem(VERIFY_EXPIRES_KEY);
	} catch {
		return null;
	}
}

export function setStoredDeleteVerifyExpiresAt(iso: string | null): void {
	try {
		if (!iso) sessionStorage.removeItem(VERIFY_EXPIRES_KEY);
		else sessionStorage.setItem(VERIFY_EXPIRES_KEY, iso);
	} catch {
		/* ignore */
	}
}

export function useAccountDeletion() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureAuth = useEnsureWsAuth();
	const [status, setStatus] = useState<DeleteAccountStatus>('none');
	const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const applyStatus = useCallback((res: DeleteStatusResponse) => {
		setStatus(res.status);
		setScheduledDeleteAt(res.scheduledDeleteAt ?? null);
	}, []);

	const canUseWs = wsConnected && wsAuthReady;

	const refreshStatus = useCallback(() => {
		setLoading(true);
		setError(null);
		const run = canUseWs ?
			ensureAuth().then(() => userWsDeleteStatus(ws)) :
			creatorsApi.me.deleteStatus();
		return run
			.then(applyStatus)
			.catch((e: unknown) => {
				setError(apiErrorMessage(e, 'Could not load deletion status'));
				throw e;
			})
			.finally(() => setLoading(false));
	}, [applyStatus, canUseWs, ensureAuth, ws]);

	const requestDeletion = useCallback(() => {
		setLoading(true);
		setError(null);
		const run = canUseWs ?
			ensureAuth().then(() => userWsDeleteRequest(ws)) :
			creatorsApi.me.deleteRequest();
		return run
			.then(res => {
				if (res.expiresAt) setStoredDeleteVerifyExpiresAt(res.expiresAt);
				return refreshStatus().then(() => res);
			})
			.catch((e: unknown) => {
				const msg = apiErrorMessage(e, 'Could not start account deletion');
				setError(msg);
				throw e;
			})
			.finally(() => setLoading(false));
	}, [canUseWs, ensureAuth, refreshStatus, ws]);

	const verifyDeletion = useCallback((code: string) => {
		setLoading(true);
		setError(null);
		const trimmed = code.trim();
		const run = canUseWs ?
			ensureAuth().then(() => userWsDeleteVerify(ws, trimmed)) :
			creatorsApi.me.deleteVerify({ code: trimmed });
		return run
			.then(res => {
				setStoredDeleteVerifyExpiresAt(null);
				return refreshStatus().then(() => res);
			})
			.catch((e: unknown) => {
				const msg = apiErrorMessage(e, 'Invalid or expired verification code');
				setError(msg);
				throw e;
			})
			.finally(() => setLoading(false));
	}, [canUseWs, ensureAuth, refreshStatus, ws]);

	const exportData = useCallback(() => {
		setLoading(true);
		setError(null);
		const run = canUseWs ?
			ensureAuth().then(() => userWsExport(ws)) :
			creatorsApi.me.exportData();
		return run
			.catch((e: unknown) => {
				const msg = apiErrorMessage(e, 'Could not start data export');
				setError(msg);
				throw e;
			})
			.finally(() => setLoading(false));
	}, [canUseWs, ensureAuth, ws]);

	return {
		status,
		scheduledDeleteAt,
		loading,
		error,
		setError,
		refreshStatus,
		requestDeletion,
		verifyDeletion,
		exportData,
	};
}
