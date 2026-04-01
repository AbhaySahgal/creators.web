import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Conversation, Message } from '../types';
import { mockConversations, mockMessages } from '../data/messages';

interface ChatState {
	conversations: Conversation[];
	messages: Record<string, Message[]>;
	activeConversationId: string | null;
}

type ChatAction =
	| { type: 'SEND_MESSAGE', payload: Message } |
	{ type: 'UNLOCK_MESSAGE', payload: { messageId: string, conversationId: string } } |
	{ type: 'MARK_READ', payload: string } |
	{ type: 'SET_ACTIVE', payload: string | null } |
	{ type: 'ADD_CONVERSATION', payload: Conversation };

const initialState: ChatState = {
	conversations: mockConversations,
	messages: mockMessages,
	activeConversationId: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
	switch (action.type) {
		case 'SEND_MESSAGE': {
			const convId = action.payload.conversationId;
			const existing = state.messages[convId] ?? [];
			return {
				...state,
				messages: { ...state.messages, [convId]: [...existing, action.payload] },
				conversations: state.conversations.map(c =>
					c.id === convId ?
						{ ...c, lastMessage: action.payload.content, lastMessageTime: action.payload.createdAt } :
						c
				),
			};
		}
		case 'UNLOCK_MESSAGE': {
			const { messageId, conversationId } = action.payload;
			return {
				...state,
				messages: {
					...state.messages,
					[conversationId]: (state.messages[conversationId] ?? []).map(m =>
						m.id === messageId ? { ...m, isUnlocked: true } : m
					),
				},
			};
		}
		case 'MARK_READ': {
			return {
				...state,
				conversations: state.conversations.map(c =>
					c.id === action.payload ? { ...c, unreadCount: 0 } : c
				),
				messages: {
					...state.messages,
					[action.payload]: (state.messages[action.payload] ?? []).map(m => ({ ...m, isSeen: true })),
				},
			};
		}
		case 'SET_ACTIVE':
			return { ...state, activeConversationId: action.payload };
		case 'ADD_CONVERSATION':
			return {
				...state,
				conversations: [action.payload, ...state.conversations],
				messages: { ...state.messages, [action.payload.id]: [] },
			};
		default:
			return state;
	}
}

interface ChatContextValue {
	state: ChatState;
	sendMessage: (message: Message) => void;
	unlockMessage: (messageId: string, conversationId: string) => void;
	markRead: (conversationId: string) => void;
	setActive: (conversationId: string | null) => void;
	addConversation: (conv: Conversation) => void;
	getConversationForUser: (userId: string) => Conversation | null;
	totalUnread: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(chatReducer, initialState);

	const sendMessage = useCallback((message: Message) => {
		dispatch({ type: 'SEND_MESSAGE', payload: message });
	}, []);

	const unlockMessage = useCallback((messageId: string, conversationId: string) => {
		dispatch({ type: 'UNLOCK_MESSAGE', payload: { messageId, conversationId } });
	}, []);

	const markRead = useCallback((conversationId: string) => {
		dispatch({ type: 'MARK_READ', payload: conversationId });
	}, []);

	const setActive = useCallback((conversationId: string | null) => {
		dispatch({ type: 'SET_ACTIVE', payload: conversationId });
	}, []);

	const addConversation = useCallback((conv: Conversation) => {
		dispatch({ type: 'ADD_CONVERSATION', payload: conv });
	}, []);

	const getConversationForUser = useCallback((userId: string) => {
		return state.conversations.find(c => c.participantIds.includes(userId)) ?? null;
	}, [state.conversations]);

	const totalUnread = state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);

	return (
		<ChatContext.Provider value={{
			state, sendMessage, unlockMessage, markRead,
			setActive, addConversation, getConversationForUser, totalUnread,
		}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChat() {
	const ctx = useContext(ChatContext);
	if (!ctx) throw new Error('useChat must be used within ChatProvider');
	return ctx;
}
