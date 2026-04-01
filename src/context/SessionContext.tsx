import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { TimedSession, SessionType } from '../types';

interface SessionState {
	activeSession: TimedSession | null;
	sessionHistory: TimedSession[];
	secondsRemaining: number;
	warningShown: boolean;
}

type SessionAction =
	| { type: 'START_SESSION', payload: TimedSession } |
	{ type: 'END_SESSION', payload: { endedAt: string, actualDurationSeconds: number, refundAmount?: number } } |
	{ type: 'TICK' } |
	{ type: 'SHOW_WARNING' } |
	{ type: 'ADD_TO_HISTORY', payload: TimedSession };

const WARNING_THRESHOLD_SECONDS = 60;

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
	switch (action.type) {
		case 'START_SESSION':
			return {
				...state,
				activeSession: action.payload,
				secondsRemaining: action.payload.durationMinutes * 60,
				warningShown: false,
			};
		case 'TICK': {
			const next = state.secondsRemaining - 1;
			return { ...state, secondsRemaining: Math.max(0, next) };
		}
		case 'SHOW_WARNING':
			return { ...state, warningShown: true };
		case 'END_SESSION': {
			if (!state.activeSession) return state;
			const ended: TimedSession = {
				...state.activeSession,
				...action.payload,
				status: 'ended',
			};
			return {
				...state,
				activeSession: null,
				secondsRemaining: 0,
				warningShown: false,
				sessionHistory: [ended, ...state.sessionHistory],
			};
		}
		case 'ADD_TO_HISTORY':
			return { ...state, sessionHistory: [action.payload, ...state.sessionHistory] };
		default:
			return state;
	}
}

const MOCK_SESSION_HISTORY: TimedSession[] = [
	{
		id: 'sess-1',
		type: 'video',
		creatorId: 'creator-1',
		creatorName: 'Luna Rose',
		creatorAvatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		fanId: 'fan-1',
		fanName: 'Jamie Hart',
		durationMinutes: 10,
		ratePerMinute: 2.99,
		totalCost: 29.90,
		startedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
		endedAt: new Date(Date.now() - 86400000 * 2 + 600000).toISOString(),
		actualDurationSeconds: 600,
		status: 'ended',
		earnings: 29.90,
	},
	{
		id: 'sess-2',
		type: 'audio',
		creatorId: 'creator-3',
		creatorName: 'Marcus Dev',
		creatorAvatar: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		fanId: 'fan-1',
		fanName: 'Jamie Hart',
		durationMinutes: 15,
		ratePerMinute: 4.99,
		totalCost: 74.85,
		startedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
		endedAt: new Date(Date.now() - 86400000 * 5 + 900000).toISOString(),
		actualDurationSeconds: 900,
		status: 'ended',
		earnings: 74.85,
	},
	{
		id: 'sess-3',
		type: 'chat',
		creatorId: 'creator-2',
		creatorName: 'Sophia Chen',
		creatorAvatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		fanId: 'fan-1',
		fanName: 'Jamie Hart',
		durationMinutes: 5,
		ratePerMinute: 3.99,
		totalCost: 19.95,
		startedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
		endedAt: new Date(Date.now() - 86400000 * 7 + 300000).toISOString(),
		actualDurationSeconds: 287,
		refundAmount: 0.52,
		status: 'ended',
		earnings: 19.43,
	},
];

const initialState: SessionState = {
	activeSession: null,
	sessionHistory: MOCK_SESSION_HISTORY,
	secondsRemaining: 0,
	warningShown: false,
};

interface SessionContextValue {
	state: SessionState;
	startSession: (
		type: SessionType,
		creatorId: string,
		creatorName: string,
		creatorAvatar: string,
		fanId: string,
		fanName: string,
		durationMinutes: number,
		ratePerMinute: number
	) => void;
	endSessionEarly: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(sessionReducer, initialState);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const endCallbackRef = useRef<(() => void) | null>(null);

	const clearTick = () => {
		if (tickRef.current) {
			clearInterval(tickRef.current);
			tickRef.current = null;
		}
	};

	const startSession = useCallback((
		type: SessionType,
		creatorId: string,
		creatorName: string,
		creatorAvatar: string,
		fanId: string,
		fanName: string,
		durationMinutes: number,
		ratePerMinute: number
	) => {
		clearTick();
		const totalCost = parseFloat((durationMinutes * ratePerMinute).toFixed(2));
		const session: TimedSession = {
			id: `sess-${Date.now()}`,
			type,
			creatorId,
			creatorName,
			creatorAvatar,
			fanId,
			fanName,
			durationMinutes,
			ratePerMinute,
			totalCost,
			startedAt: new Date().toISOString(),
			status: 'active',
			earnings: totalCost,
		};
		dispatch({ type: 'START_SESSION', payload: session });

		let secondsLeft = durationMinutes * 60;
		tickRef.current = setInterval(() => {
			secondsLeft -= 1;
			dispatch({ type: 'TICK' });
			if (secondsLeft === WARNING_THRESHOLD_SECONDS) {
				dispatch({ type: 'SHOW_WARNING' });
			}
			if (secondsLeft <= 0) {
				clearTick();
				const endedAt = new Date().toISOString();
				const actualDurationSeconds = durationMinutes * 60;
				dispatch({ type: 'END_SESSION', payload: { endedAt, actualDurationSeconds } });
				if (endCallbackRef.current) endCallbackRef.current();
			}
		}, 1000);
	}, []);

	const endSessionEarly = useCallback(() => {
		clearTick();
		if (!state.activeSession) return;
		const startTime = new Date(state.activeSession.startedAt).getTime();
		const actualDurationSeconds = Math.floor((Date.now() - startTime) / 1000);
		const usedMinutes = actualDurationSeconds / 60;
		const usedCost = parseFloat((usedMinutes * state.activeSession.ratePerMinute).toFixed(2));
		const refundAmount = parseFloat((state.activeSession.totalCost - usedCost).toFixed(2));
		dispatch({
			type: 'END_SESSION',
			payload: {
				endedAt: new Date().toISOString(),
				actualDurationSeconds,
				refundAmount: refundAmount > 0 ? refundAmount : undefined,
			},
		});
	}, [state.activeSession]);

	return (
		<SessionContext.Provider value={{ state, startSession, endSessionEarly }}>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession() {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error('useSession must be used within SessionProvider');
	return ctx;
}
