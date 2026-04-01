import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Notification } from '../types';
import { mockNotifications } from '../data/transactions';

interface ToastItem {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationState {
	notifications: Notification[];
	toasts: ToastItem[];
}

type NotificationAction =
	| { type: 'ADD_NOTIFICATION', payload: Notification } |
	{ type: 'MARK_READ', payload: string } |
	{ type: 'MARK_ALL_READ' } |
	{ type: 'ADD_TOAST', payload: ToastItem } |
	{ type: 'REMOVE_TOAST', payload: string };

const initialState: NotificationState = {
	notifications: mockNotifications,
	toasts: [],
};

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
	switch (action.type) {
		case 'ADD_NOTIFICATION':
			return { ...state, notifications: [action.payload, ...state.notifications] };
		case 'MARK_READ':
			return {
				...state,
				notifications: state.notifications.map(n =>
					n.id === action.payload ? { ...n, isRead: true } : n
				),
			};
		case 'MARK_ALL_READ':
			return { ...state, notifications: state.notifications.map(n => ({ ...n, isRead: true })) };
		case 'ADD_TOAST':
			return { ...state, toasts: [...state.toasts, action.payload] };
		case 'REMOVE_TOAST':
			return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
		default:
			return state;
	}
}

interface NotificationContextValue {
	state: NotificationState;
	addNotification: (notification: Notification) => void;
	markRead: (id: string) => void;
	markAllRead: () => void;
	showToast: (message: string, type?: ToastItem['type']) => void;
	getUserNotifications: (userId: string) => Notification[];
	getUnreadCount: (userId: string) => number;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(notificationReducer, initialState);

	const addNotification = useCallback((notification: Notification) => {
		dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
	}, []);

	const markRead = useCallback((id: string) => {
		dispatch({ type: 'MARK_READ', payload: id });
	}, []);

	const markAllRead = useCallback(() => {
		dispatch({ type: 'MARK_ALL_READ' });
	}, []);

	const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
		const id = `toast-${Date.now()}`;
		dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
		setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
	}, []);

	const getUserNotifications = useCallback((userId: string) => {
		return state.notifications.filter(n => n.userId === userId);
	}, [state.notifications]);

	const getUnreadCount = useCallback((userId: string) => {
		return state.notifications.filter(n => n.userId === userId && !n.isRead).length;
	}, [state.notifications]);

	return (
		<NotificationContext.Provider value={{
			state, addNotification, markRead, markAllRead,
			showToast, getUserNotifications, getUnreadCount,
		}}
		>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotifications() {
	const ctx = useContext(NotificationContext);
	if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
	return ctx;
}
