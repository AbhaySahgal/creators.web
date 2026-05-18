import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KYCApplication } from '../types';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import { createAdminWs } from '../services/adminWsService';
import { kycApplicationToUi } from '../services/kycMap';
import type { KycApplicationDto } from '../services/kycTypes';

export type AdminKycTab = 'pending' | 'all';

function dtoListToUi(rows: KycApplicationDto[]): KYCApplication[] {
	return rows.map(kycApplicationToUi);
}

export function useAdminKyc(opts?: { tab?: AdminKycTab, limit?: number, autoLoad?: boolean }) {
	const tab = opts?.tab ?? 'pending';
	const limit = opts?.limit ?? 30;
	const autoLoad = opts?.autoLoad ?? true;

	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const adminWs = useMemo(() => createAdminWs(ws), [ws]);

	const [applications, setApplications] = useState<KYCApplication[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [pendingCount, setPendingCount] = useState<number | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const loadGenRef = useRef(0);

	const wsReady = wsConnected && wsAuthReady;

	const fetchList = useCallback((cursor?: string | null, replace = true): Promise<void> => {
		const gen = ++loadGenRef.current;
		const status = tab === 'pending' ? 'pending' : undefined;

		const httpList = () =>
			creatorsApi.admin.kyc.list({
				status,
				limit,
				before: cursor ?? undefined,
			});

		const wsList = () =>
			ensureWsAuth().then(() =>
				adminWs.listKyc({ status, limit, cursor: cursor ?? undefined })
			);

		const run = wsReady && !cursor ? wsList().catch(() => httpList()) : httpList();

		if (replace) setLoading(true);
		else setLoadingMore(true);
		setError(null);

		return run
			.then(res => {
				if (gen !== loadGenRef.current) return;
				const ui = dtoListToUi(res.applications);
				setApplications(prev => (replace ? ui : [...prev, ...ui]));
				setNextCursor(res.nextCursor ?? null);
				if (typeof res.pendingCount === 'number') setPendingCount(res.pendingCount);
				else if (tab === 'pending' && replace) setPendingCount(ui.length);
			})
			.catch(err => {
				if (gen !== loadGenRef.current) return;
				setError(apiErrorMessage(err, 'Failed to load KYC applications'));
			})
			.finally(() => {
				if (gen !== loadGenRef.current) return;
				setLoading(false);
				setLoadingMore(false);
			});
	}, [adminWs, ensureWsAuth, limit, tab, wsReady]);

	useEffect(() => {
		if (!autoLoad) return;
		void fetchList(null, true);
	}, [autoLoad, fetchList, tab]);

	const loadMore = useCallback(() => {
		if (!nextCursor || loadingMore) return Promise.resolve();
		return fetchList(nextCursor, false);
	}, [fetchList, loadingMore, nextCursor]);

	const approve = useCallback((applicationId: string): Promise<void> => {
		const http = () => creatorsApi.admin.kyc.approve(applicationId).then(() => undefined);
		const wsCall = () =>
			ensureWsAuth().then(() => adminWs.approveKyc(applicationId)).then(() => undefined);
		return (wsReady ? wsCall().catch(() => http()) : http())
			.then(() => {
				setApplications(prev =>
					prev.map(a => a.id === applicationId ? { ...a, status: 'approved' } : a)
				);
				setPendingCount(c => (typeof c === 'number' ? Math.max(0, c - 1) : c));
			});
	}, [adminWs, ensureWsAuth, wsReady]);

	const reject = useCallback((applicationId: string, reason: string): Promise<void> => {
		const http = () => creatorsApi.admin.kyc.reject(applicationId, reason).then(() => undefined);
		const wsCall = () =>
			ensureWsAuth().then(() => adminWs.rejectKyc(applicationId, reason)).then(() => undefined);
		return (wsReady ? wsCall().catch(() => http()) : http())
			.then(() => {
				setApplications(prev =>
					prev.map(a =>
						a.id === applicationId ?
							{ ...a, status: 'rejected', rejectionReason: reason } :
							a
					)
				);
				setPendingCount(c => (typeof c === 'number' ? Math.max(0, c - 1) : c));
			});
	}, [adminWs, ensureWsAuth, wsReady]);

	const refresh = useCallback(() => fetchList(null, true), [fetchList]);

	return useMemo(() => ({
		applications,
		nextCursor,
		pendingCount,
		loading,
		loadingMore,
		error,
		loadMore,
		approve,
		reject,
		refresh,
	}), [
		applications,
		nextCursor,
		pendingCount,
		loading,
		loadingMore,
		error,
		loadMore,
		approve,
		reject,
		refresh,
	]);
}

/** Lightweight pending count for admin dashboard cards. */
export function useAdminKycPendingCount() {
	const { pendingCount, loading, refresh } = useAdminKyc({ tab: 'pending', limit: 1, autoLoad: true });
	return { pendingCount: pendingCount ?? 0, loading, refresh };
}
