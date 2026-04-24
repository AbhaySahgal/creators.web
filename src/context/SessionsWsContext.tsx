import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { fetchWsToken } from '../services/wsTokenApi';
import { WsMuxClient } from '../services/ws/WsMuxClient';
import {
	sessionsAccept,
	sessionsComplete,
	sessionsFeedback,
	sessionsRequest,
	type SessionsAcceptResponse,
	type SessionsEndedPush,
	type SessionsRequestPush,
	type SessionsRequestResponse,
	type SessionsTimerPush,
} from '../services/ws/sessionsWs';
import { chatJoinRoom, chatSendMsg, type ChatMessage } from '../services/ws/chatWs';

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

export type BookingStatus = 'pending' | 'accepted' | 'ended';

export interface Booking {
	request_id: string;
	status: BookingStatus;
	creator_user_id: string;
	fan_user_id: string;
	room_id?: string;
	price_cents?: number;
	started_at?: string;
	ends_at?: string;
	reason?: string;
	feedbackPrompted?: boolean;
	feedback?: Record<string, { rating: number, comment?: string }>;
}

export interface IncomingRequest extends SessionsRequestPush {
	creator_user_id: string;
	status: 'pending';
	received_at: string;
}

interface SessionsWsContextValue {
	connected: boolean;
	activeBooking: Booking | null;
	incomingRequests: IncomingRequest[];

	requestChat: (creatorUserId: string, minutes: number) => Promise<SessionsRequestResponse>;
	acceptRequest: (requestId: string) => Promise<SessionsAcceptResponse>;
	complete: (requestId: string) => Promise<{ ok: boolean, alreadyCompleted?: boolean }>;
	submitFeedback: (requestId: string, rating: number, comment: string) => Promise<void>;

	joinRoom: (roomId: string) => Promise<void>;
	sendRoomMessage: (roomId: string, text: string) => Promise<ChatMessage>;

	onRoomMessage: (roomId: string, handler: (msg: ChatMessage) => void) => () => void;
}

const SessionsWsContext = createContext<SessionsWsContextValue | null>(null);

function parseUserIdToString(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	return '';
}

export function SessionsWsProvider({ children }: { children: React.ReactNode }) {
	const { state: authState } = useAuth();
	const { showToast } = useNotifications();

	const muxRef = useRef<WsMuxClient | null>(null);
	if (!muxRef.current) muxRef.current = new WsMuxClient();
	const mux = muxRef.current;

	const [connected, setConnected] = useState(false);
	const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
	const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

	const roomListenersRef = useRef(new Map<string, Set<(msg: ChatMessage) => void>>());

	const connect = useCallback(async () => {
		if (!WS_URL) throw new Error('VITE_WS_URL is not configured');
		const token = await fetchWsToken();
		const url = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
		mux.connect(url);
	}, [mux]);

	useEffect(() => {
		if (!authState.isAuthenticated || !authState.user) {
			mux.close();
			setConnected(false);
			setActiveBooking(null);
			setIncomingRequests([]);
			return;
		}

		let cancelled = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

		const tryConnect = async (attempt: number) => {
			try {
				await connect();
			} catch (err) {
				if (cancelled) return;
				const msg = err instanceof Error ? err.message : 'Failed to connect WebSocket';
				showToast(msg, 'error');
				const backoffMs = Math.min(30000, 1000 * (2 ** Math.min(attempt, 5)));
				reconnectTimer = setTimeout(() => {
					void tryConnect(attempt + 1);
				}, backoffMs);
			}
		};

		void tryConnect(0);

		const poll = setInterval(() => {
			setConnected(mux.getReadyState() === WebSocket.OPEN);
		}, 500);

		return () => {
			cancelled = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			clearInterval(poll);
		};
	}, [authState.isAuthenticated, authState.user, connect, mux, showToast]);

	// sessions push wiring
	useEffect(() => {
		const userId = authState.user?.id;
		if (!userId) return;

		const unsubRequest = mux.on('sessions', 'request', payload => {
			const p = payload as Partial<SessionsRequestPush>;
			const creator_user_id = parseUserIdToString((p as any).creator_user_id) || userId;
			const fan_user_id = parseUserIdToString(p.fan_user_id);
			if (!fan_user_id || !p.request_id) return;
			setIncomingRequests(prev => [
				{
					...(p as SessionsRequestPush),
					creator_user_id,
					status: 'pending',
					received_at: new Date().toISOString(),
				},
				...prev.filter(r => r.request_id !== p.request_id),
			]);
		});

		const unsubAccepted = mux.on('sessions', 'accepted', payload => {
			const p = payload as Partial<SessionsAcceptResponse>;
			if (!p.request_id) return;
			setActiveBooking(prev => {
				const next: Booking = {
					request_id: p.request_id!,
					status: 'accepted',
					creator_user_id: prev?.creator_user_id ?? '',
					fan_user_id: prev?.fan_user_id ?? userId,
					room_id: p.room_id,
					started_at: p.started_at,
					ends_at: p.ends_at,
					price_cents: p.price_cents,
				};
				return next;
			});
		});

		const unsubTimer = mux.on('sessions', 'timer', payload => {
			const p = payload as Partial<SessionsTimerPush>;
			if (!p.request_id) return;
			setActiveBooking(prev => {
				if (!prev || prev.request_id !== p.request_id) return prev;
				return { ...prev, ends_at: p.ends_at ?? prev.ends_at, room_id: p.room_id ?? prev.room_id };
			});
		});

		const unsubEnded = mux.on('sessions', 'ended', payload => {
			const p = payload as Partial<SessionsEndedPush>;
			if (!p.request_id) return;
			setActiveBooking(prev => {
				if (!prev || prev.request_id !== p.request_id) return prev;
				return { ...prev, status: 'ended', reason: p.reason ?? prev.reason, room_id: p.room_id ?? prev.room_id };
			});
		});

		const unsubFeedbackPrompt = mux.on('sessions', 'feedbackprompt', payload => {
			const p = payload as { request_id?: string };
			if (!p?.request_id) return;
			setActiveBooking(prev => {
				if (!prev || prev.request_id !== p.request_id) return prev;
				return { ...prev, feedbackPrompted: true };
			});
		});

		const unsubFeedbackReceived = mux.on('sessions', 'feedbackreceived', payload => {
			const p = payload as { request_id?: string, from_user_id?: string, rating?: number, comment?: string };
			if (!p?.request_id || !p.from_user_id || typeof p.rating !== 'number') return;
			setActiveBooking(prev => {
				if (!prev || prev.request_id !== p.request_id) return prev;
				const fromUserId = parseUserIdToString(p.from_user_id);
				if (!fromUserId) return prev;
				return {
					...prev,
					feedback: {
						...(prev.feedback ?? {}),
						[fromUserId]: { rating: p.rating!, comment: p.comment },
					},
				};
			});
		});

		return () => {
			unsubRequest();
			unsubAccepted();
			unsubTimer();
			unsubEnded();
			unsubFeedbackPrompt();
			unsubFeedbackReceived();
		};
	}, [authState.user?.id, mux]);

	// chat push wiring
	useEffect(() => {
		const unsubNewMessage = mux.on('chat', 'newmessage', payload => {
			const msg = payload as ChatMessage;
			const roomId = msg.room_id;
			if (!roomId) return;
			const listeners = roomListenersRef.current.get(roomId);
			if (!listeners) return;
			listeners.forEach(fn => fn(msg));
		});
		return () => unsubNewMessage();
	}, [mux]);

	const requestChat = useCallback(async (creatorUserId: string, minutes: number) => {
		const userId = authState.user?.id;
		if (!userId) throw new Error('Not authenticated');
		const reqId = mux.createRequestId('s');
		const resp = await sessionsRequest(mux, reqId, creatorUserId, 'chat', minutes);
		setActiveBooking({
			request_id: resp.request_id,
			status: 'pending',
			creator_user_id: creatorUserId,
			fan_user_id: userId,
			price_cents: resp.price_cents,
		});
		return resp;
	}, [authState.user?.id, mux]);

	const acceptRequest = useCallback(async (requestId: string) => {
		const userId = authState.user?.id;
		if (!userId) throw new Error('Not authenticated');
		const reqId = mux.createRequestId('s');
		const resp = await sessionsAccept(mux, reqId, requestId);
		setIncomingRequests(prev => prev.filter(r => r.request_id !== requestId));
		setActiveBooking({
			request_id: resp.request_id,
			status: 'accepted',
			creator_user_id: userId,
			fan_user_id: '',
			room_id: resp.room_id,
			started_at: resp.started_at,
			ends_at: resp.ends_at,
			price_cents: resp.price_cents,
		});
		return resp;
	}, [authState.user?.id, mux]);

	const complete = useCallback(async (requestId: string) => {
		const reqId = mux.createRequestId('s');
		return sessionsComplete(mux, reqId, requestId);
	}, [mux]);

	const submitFeedback = useCallback(async (requestId: string, rating: number, comment: string) => {
		const reqId = mux.createRequestId('s');
		await sessionsFeedback(mux, reqId, requestId, rating, comment);
	}, [mux]);

	const joinRoom = useCallback(async (roomId: string) => {
		const reqId = mux.createRequestId('c');
		await chatJoinRoom(mux, reqId, roomId);
	}, [mux]);

	const sendRoomMessage = useCallback(async (roomId: string, text: string) => {
		const reqId = mux.createRequestId('c');
		const resp = await chatSendMsg(mux, reqId, roomId, text);
		return resp.message;
	}, [mux]);

	const onRoomMessage = useCallback((roomId: string, handler: (msg: ChatMessage) => void) => {
		const map = roomListenersRef.current;
		const set = map.get(roomId) ?? new Set<(msg: ChatMessage) => void>();
		set.add(handler);
		map.set(roomId, set);
		return () => {
			const current = map.get(roomId);
			if (!current) return;
			current.delete(handler);
			if (current.size === 0) map.delete(roomId);
		};
	}, []);

	const value = useMemo<SessionsWsContextValue>(() => ({
		connected,
		activeBooking,
		incomingRequests,
		requestChat,
		acceptRequest,
		complete,
		submitFeedback,
		joinRoom,
		sendRoomMessage,
		onRoomMessage,
	}), [
		connected,
		activeBooking,
		incomingRequests,
		requestChat,
		acceptRequest,
		complete,
		submitFeedback,
		joinRoom,
		sendRoomMessage,
		onRoomMessage,
	]);

	return <SessionsWsContext.Provider value={value}>{children}</SessionsWsContext.Provider>;
}

export function useSessionsWs() {
	const ctx = useContext(SessionsWsContext);
	if (!ctx) throw new Error('useSessionsWs must be used within SessionsWsProvider');
	return ctx;
}

