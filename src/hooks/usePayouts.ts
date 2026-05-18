import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import { createPaymentWs } from '../services/paymentWs';
import type { PayoutBalance, PayoutWithdrawalRow, PayoutWithdrawResult } from '../services/payoutTypes';
import type { CreatorKycStatus } from '../types';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';

const HISTORY_PAGE = 20;

function fetchBalanceWs(
	ensureWsAuth: () => Promise<void>,
	paymentWs: ReturnType<typeof createPaymentWs>
): Promise<PayoutBalance> {
	return ensureWsAuth()
		.then(() => paymentWs.payoutBalance())
		.catch(() => creatorsApi.me.payouts.balance());
}

function fetchHistoryWs(
	ensureWsAuth: () => Promise<void>,
	paymentWs: ReturnType<typeof createPaymentWs>,
	limit: number,
	before?: string
) {
	return ensureWsAuth()
		.then(() => paymentWs.payoutHistory(limit, before))
		.catch(() => creatorsApi.me.payouts.history({ limit, before }));
}

function fetchWithdrawWs(
	ensureWsAuth: () => Promise<void>,
	paymentWs: ReturnType<typeof createPaymentWs>,
	amountCents: string
): Promise<PayoutWithdrawResult> {
	return ensureWsAuth()
		.then(() => paymentWs.withdraw(amountCents))
		.catch(() => creatorsApi.me.payouts.withdraw({ amountCents }));
}

export function usePayouts(fallbackKycStatus?: CreatorKycStatus) {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const paymentWs = useMemo(() => createPaymentWs(ws), [ws]);

	const [balance, setBalance] = useState<PayoutBalance | null>(null);
	const [balanceLoading, setBalanceLoading] = useState(true);
	const [balanceError, setBalanceError] = useState<string | null>(null);

	const [withdrawals, setWithdrawals] = useState<PayoutWithdrawalRow[]>([]);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [historyCursor, setHistoryCursor] = useState<string | null>(null);
	const [hasMoreHistory, setHasMoreHistory] = useState(false);

	const [withdrawing, setWithdrawing] = useState(false);

	const kycStatus: CreatorKycStatus =
		balance?.kycStatus ?? fallbackKycStatus ?? 'not_submitted';
	const canWithdraw = kycStatus === 'approved';

	const loadBalance = useCallback(() => {
		setBalanceLoading(true);
		setBalanceError(null);
		const task =
			wsConnected && wsAuthReady ?
				fetchBalanceWs(ensureWsAuth, paymentWs) :
				creatorsApi.me.payouts.balance();
		return task
			.then(b => { setBalance(b); })
			.catch(e => { setBalanceError(apiErrorMessage(e, 'Could not load payout balance')); })
			.finally(() => { setBalanceLoading(false); });
	}, [ensureWsAuth, paymentWs, wsAuthReady, wsConnected]);

	const loadHistory = useCallback((append: boolean, cursor: string | null) => {
		if (append) setHistoryLoadingMore(true);
		else setHistoryLoading(true);
		setHistoryError(null);
		const before = append && cursor ? cursor : undefined;
		const task =
			wsConnected && wsAuthReady ?
				fetchHistoryWs(ensureWsAuth, paymentWs, HISTORY_PAGE, before) :
				creatorsApi.me.payouts.history({ limit: HISTORY_PAGE, before });
		return task
			.then(page => {
				setHistoryCursor(page.nextCursor);
				setHasMoreHistory(Boolean(page.nextCursor));
				setWithdrawals(prev =>
					append ? [...prev, ...page.withdrawals] : page.withdrawals
				);
			})
			.catch(e => { setHistoryError(apiErrorMessage(e, 'Could not load withdrawal history')); })
			.finally(() => {
				setHistoryLoading(false);
				setHistoryLoadingMore(false);
			});
	}, [ensureWsAuth, paymentWs, wsAuthReady, wsConnected]);

	const reloadHistory = useCallback(() => loadHistory(false, null), [loadHistory]);

	const loadMoreHistory = useCallback(
		() => loadHistory(true, historyCursor),
		[loadHistory, historyCursor]
	);

	const requestWithdraw = useCallback((amountCents: string): Promise<PayoutWithdrawResult> => {
		setWithdrawing(true);
		const task =
			wsConnected && wsAuthReady ?
				fetchWithdrawWs(ensureWsAuth, paymentWs, amountCents) :
				creatorsApi.me.payouts.withdraw({ amountCents });
		return task
			.then(result =>
				Promise.all([loadBalance(), loadHistory(false, null)]).then(() => result)
			)
			.finally(() => { setWithdrawing(false); });
	}, [ensureWsAuth, loadBalance, loadHistory, paymentWs, wsAuthReady, wsConnected]);

	useEffect(() => {
		void loadBalance();
	}, [loadBalance]);

	useEffect(() => {
		void loadHistory(false, null);
	}, [loadHistory]);

	return {
		balance,
		balanceLoading,
		balanceError,
		reloadBalance: loadBalance,
		withdrawals,
		historyLoading,
		historyLoadingMore,
		historyError,
		historyCursor,
		hasMoreHistory,
		loadMoreHistory,
		reloadHistory,
		withdrawing,
		requestWithdraw,
		kycStatus,
		canWithdraw,
	};
}
