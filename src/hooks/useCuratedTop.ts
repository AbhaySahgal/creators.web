import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import { createAdminWs } from '../services/adminWsService';
import type { CuratedTopSlotDto } from '../services/kycTypes';

export interface CuratedTopSlotUi {
	creatorUserId: string;
	rank: number;
	username?: string;
	name?: string;
	avatarUrl?: string;
}

function dtoToUi(row: CuratedTopSlotDto): CuratedTopSlotUi {
	return {
		creatorUserId: row.creator_user_id,
		rank: row.rank,
		username: row.username ?? undefined,
		name: row.name ?? undefined,
		avatarUrl: row.avatar_url ?? undefined,
	};
}

function uiToSetBody(slots: CuratedTopSlotUi[]) {
	return {
		slots: slots.map(s => ({
			creatorUserId: s.creatorUserId.trim(),
			rank: s.rank,
		})),
	};
}

export function useCuratedTop() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const adminWs = useMemo(() => createAdminWs(ws), [ws]);

	const [slots, setSlots] = useState<CuratedTopSlotUi[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const wsReady = wsConnected && wsAuthReady;

	const load = useCallback((): Promise<void> => {
		setLoading(true);
		setError(null);
		const http = () => creatorsApi.admin.curatedTop.get();
		const wsGet = () => ensureWsAuth().then(() => adminWs.getCuratedTop());
		return (wsReady ? wsGet().catch(() => http()) : http())
			.then(res => {
				setSlots(res.slots.map(dtoToUi));
			})
			.catch(err => {
				setError(apiErrorMessage(err, 'Failed to load curated top'));
			})
			.finally(() => {
				setLoading(false);
			});
	}, [adminWs, ensureWsAuth, wsReady]);

	useEffect(() => {
		void load();
	}, [load]);

	const save = useCallback((nextSlots: CuratedTopSlotUi[]): Promise<void> => {
		setSaving(true);
		setError(null);
		const body = uiToSetBody(nextSlots);
		const http = () => creatorsApi.admin.curatedTop.set(body);
		const wsSet = () => ensureWsAuth().then(() => adminWs.setCuratedTop(body));
		return (wsReady ? wsSet().catch(() => http()) : http())
			.then(res => {
				setSlots(res.slots.map(dtoToUi));
			})
			.catch(err => {
				const msg = apiErrorMessage(err, 'Failed to save curated top');
				setError(msg);
				throw err;
			})
			.finally(() => {
				setSaving(false);
			});
	}, [adminWs, ensureWsAuth, wsReady]);

	return useMemo(() => ({
		slots,
		setSlots,
		loading,
		saving,
		error,
		load,
		save,
	}), [slots, loading, saving, error, load, save]);
}
