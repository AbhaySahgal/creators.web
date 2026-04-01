import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { ActiveCall, CallRecord, CallType } from '../types';

interface CallState {
	activeCall: ActiveCall | null;
	incomingCall: ActiveCall | null;
	callHistory: CallRecord[];
}

type CallAction =
	| { type: 'START_OUTGOING', payload: Omit<ActiveCall, 'isMuted' | 'isCameraOff' | 'isSpeakerOn'> } |
	{ type: 'INCOMING', payload: Omit<ActiveCall, 'isMuted' | 'isCameraOff' | 'isSpeakerOn'> } |
	{ type: 'ACCEPT' } |
	{ type: 'CONNECT' } |
	{ type: 'DECLINE' } |
	{ type: 'END' } |
	{ type: 'TOGGLE_MUTE' } |
	{ type: 'TOGGLE_CAMERA' } |
	{ type: 'TOGGLE_SPEAKER' } |
	{ type: 'ADD_HISTORY', payload: CallRecord };

const MOCK_HISTORY: CallRecord[] = [
	{
		id: 'call-1',
		type: 'video',
		direction: 'incoming',
		status: 'ended',
		participantId: 'creator-1',
		participantName: 'Luna Rose',
		participantAvatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		startedAt: '2026-03-25T14:00:00Z',
		endedAt: '2026-03-25T14:08:30Z',
		durationSeconds: 510,
	},
	{
		id: 'call-2',
		type: 'audio',
		direction: 'outgoing',
		status: 'ended',
		participantId: 'creator-2',
		participantName: 'Sophia Chen',
		participantAvatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		startedAt: '2026-03-24T11:20:00Z',
		endedAt: '2026-03-24T11:24:45Z',
		durationSeconds: 285,
	},
	{
		id: 'call-3',
		type: 'video',
		direction: 'outgoing',
		status: 'missed',
		participantId: 'creator-5',
		participantName: 'Alex Kim',
		participantAvatar: 'https://images.pexels.com/photos/2269872/pexels-photo-2269872.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		startedAt: '2026-03-23T20:10:00Z',
		durationSeconds: 0,
	},
	{
		id: 'call-4',
		type: 'audio',
		direction: 'incoming',
		status: 'missed',
		participantId: 'creator-1',
		participantName: 'Luna Rose',
		participantAvatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		startedAt: '2026-03-22T09:05:00Z',
		durationSeconds: 0,
	},
	{
		id: 'call-5',
		type: 'audio',
		direction: 'outgoing',
		status: 'ended',
		participantId: 'creator-2',
		participantName: 'Sophia Chen',
		participantAvatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		startedAt: '2026-03-21T16:30:00Z',
		endedAt: '2026-03-21T16:35:10Z',
		durationSeconds: 310,
	},
];

const initialState: CallState = {
	activeCall: null,
	incomingCall: null,
	callHistory: MOCK_HISTORY,
};

function callReducer(state: CallState, action: CallAction): CallState {
	switch (action.type) {
		case 'START_OUTGOING':
			return {
				...state,
				activeCall: { ...action.payload, isMuted: false, isCameraOff: false, isSpeakerOn: false },
				incomingCall: null,
			};
		case 'INCOMING':
			if (state.activeCall) return state;
			return {
				...state,
				incomingCall: { ...action.payload, isMuted: false, isCameraOff: false, isSpeakerOn: false },
			};
		case 'ACCEPT':
			if (!state.incomingCall) return state;
			return {
				...state,
				activeCall: { ...state.incomingCall, status: 'connecting' },
				incomingCall: null,
			};
		case 'CONNECT':
			if (!state.activeCall) return state;
			return { ...state, activeCall: { ...state.activeCall, status: 'active' } };
		case 'DECLINE':
			return { ...state, incomingCall: null };
		case 'END':
			return { ...state, activeCall: null, incomingCall: null };
		case 'TOGGLE_MUTE':
			if (!state.activeCall) return state;
			return { ...state, activeCall: { ...state.activeCall, isMuted: !state.activeCall.isMuted } };
		case 'TOGGLE_CAMERA':
			if (!state.activeCall) return state;
			return { ...state, activeCall: { ...state.activeCall, isCameraOff: !state.activeCall.isCameraOff } };
		case 'TOGGLE_SPEAKER':
			if (!state.activeCall) return state;
			return { ...state, activeCall: { ...state.activeCall, isSpeakerOn: !state.activeCall.isSpeakerOn } };
		case 'ADD_HISTORY':
			return { ...state, callHistory: [action.payload, ...state.callHistory] };
		default:
			return state;
	}
}

interface CallContextValue {
	state: CallState;
	startCall: (participantId: string, participantName: string, participantAvatar: string, type: CallType) => void;
	acceptCall: () => void;
	declineCall: () => void;
	endCall: () => void;
	toggleMute: () => void;
	toggleCamera: () => void;
	toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(callReducer, initialState);
	const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const autoDeclineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function addHistory(call: ActiveCall, status: 'ended' | 'missed' | 'declined') {
		const endedAt = new Date().toISOString();
		const start = new Date(call.startedAt).getTime();
		const duration = status === 'ended' ? Math.floor((Date.now() - start) / 1000) : 0;
		dispatch({
			type: 'ADD_HISTORY',
			payload: {
				id: `call-${Date.now()}`,
				type: call.type,
				direction: call.direction,
				status,
				participantId: call.participantId,
				participantName: call.participantName,
				participantAvatar: call.participantAvatar,
				startedAt: call.startedAt,
				endedAt,
				durationSeconds: duration,
			},
		});
	}

	const startCall = useCallback((
		participantId: string,
		participantName: string,
		participantAvatar: string,
		type: CallType
	) => {
		const callPayload: Omit<ActiveCall, 'isMuted' | 'isCameraOff' | 'isSpeakerOn'> = {
			id: `call-${Date.now()}`,
			type,
			direction: 'outgoing',
			status: 'ringing',
			participantId,
			participantName,
			participantAvatar,
			startedAt: new Date().toISOString(),
		};
		dispatch({ type: 'START_OUTGOING', payload: callPayload });

		connectTimerRef.current = setTimeout(() => {
			dispatch({ type: 'CONNECT' });
		}, 3000);
	}, []);

	const acceptCall = useCallback(() => {
		dispatch({ type: 'ACCEPT' });
		connectTimerRef.current = setTimeout(() => {
			dispatch({ type: 'CONNECT' });
		}, 1500);
	}, []);

	const declineCall = useCallback(() => {
		if (state.incomingCall) addHistory(state.incomingCall, 'declined');
		dispatch({ type: 'DECLINE' });
	}, [state.incomingCall]);

	const endCall = useCallback(() => {
		if (state.activeCall) addHistory(state.activeCall, 'ended');
		if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
		dispatch({ type: 'END' });
	}, [state.activeCall]);

	const toggleMute = useCallback(() => dispatch({ type: 'TOGGLE_MUTE' }), []);
	const toggleCamera = useCallback(() => dispatch({ type: 'TOGGLE_CAMERA' }), []);
	const toggleSpeaker = useCallback(() => dispatch({ type: 'TOGGLE_SPEAKER' }), []);

	useEffect(() => {
		return () => {
			if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
			if (autoDeclineTimerRef.current) clearTimeout(autoDeclineTimerRef.current);
		};
	}, []);

	return (
		<CallContext.Provider value={{
			state, startCall, acceptCall, declineCall, endCall,
			toggleMute, toggleCamera, toggleSpeaker,
		}}
		>
			{children}
		</CallContext.Provider>
	);
}

export function useCall() {
	const ctx = useContext(CallContext);
	if (!ctx) throw new Error('useCall must be used within CallProvider');
	return ctx;
}
