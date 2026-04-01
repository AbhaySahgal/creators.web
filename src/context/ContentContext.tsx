import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Post, Comment } from '../types';
import { mockPosts } from '../data/posts';

interface ContentState {
	posts: Post[];
	subscribedCreatorIds: string[];
}

type ContentAction =
	| { type: 'TOGGLE_LIKE', payload: { postId: string, userId: string } } |
	{ type: 'ADD_COMMENT', payload: { postId: string, comment: Comment } } |
	{ type: 'UNLOCK_POST', payload: { postId: string, userId: string } } |
	{ type: 'ADD_POST', payload: Post } |
	{ type: 'DELETE_POST', payload: string } |
	{ type: 'SUBSCRIBE', payload: string } |
	{ type: 'UNSUBSCRIBE', payload: string } |
	{ type: 'UPDATE_POST', payload: Partial<Post> & { id: string } };

const initialState: ContentState = {
	posts: mockPosts,
	subscribedCreatorIds: ['creator-1', 'creator-2'],
};

function contentReducer(state: ContentState, action: ContentAction): ContentState {
	switch (action.type) {
		case 'TOGGLE_LIKE': {
			return {
				...state,
				posts: state.posts.map(p => {
					if (p.id !== action.payload.postId) return p;
					const liked = p.likedBy.includes(action.payload.userId);
					return {
						...p,
						likes: liked ? p.likes - 1 : p.likes + 1,
						likedBy: liked ?
							p.likedBy.filter(id => id !== action.payload.userId) :
							[...p.likedBy, action.payload.userId],
					};
				}),
			};
		}
		case 'ADD_COMMENT': {
			return {
				...state,
				posts: state.posts.map(p =>
					p.id === action.payload.postId ?
						{ ...p, comments: [...p.comments, action.payload.comment] } :
						p
				),
			};
		}
		case 'UNLOCK_POST': {
			return {
				...state,
				posts: state.posts.map(p =>
					p.id === action.payload.postId ?
						{ ...p, unlockedBy: [...p.unlockedBy, action.payload.userId] } :
						p
				),
			};
		}
		case 'ADD_POST': {
			return { ...state, posts: [action.payload, ...state.posts] };
		}
		case 'DELETE_POST': {
			return { ...state, posts: state.posts.filter(p => p.id !== action.payload) };
		}
		case 'SUBSCRIBE': {
			if (state.subscribedCreatorIds.includes(action.payload)) return state;
			return { ...state, subscribedCreatorIds: [...state.subscribedCreatorIds, action.payload] };
		}
		case 'UNSUBSCRIBE': {
			return {
				...state,
				subscribedCreatorIds: state.subscribedCreatorIds.filter(id => id !== action.payload),
			};
		}
		case 'UPDATE_POST': {
			return {
				...state,
				posts: state.posts.map(p =>
					p.id === action.payload.id ? { ...p, ...action.payload } : p
				),
			};
		}
		default:
			return state;
	}
}

interface ContentContextValue {
	state: ContentState;
	toggleLike: (postId: string, userId: string) => void;
	addComment: (postId: string, comment: Comment) => void;
	unlockPost: (postId: string, userId: string) => void;
	addPost: (post: Post) => void;
	deletePost: (postId: string) => void;
	subscribe: (creatorId: string) => void;
	unsubscribe: (creatorId: string) => void;
	isSubscribed: (creatorId: string) => boolean;
	updatePost: (post: Partial<Post> & { id: string }) => void;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(contentReducer, initialState);

	const toggleLike = useCallback((postId: string, userId: string) => {
		dispatch({ type: 'TOGGLE_LIKE', payload: { postId, userId } });
	}, []);

	const addComment = useCallback((postId: string, comment: Comment) => {
		dispatch({ type: 'ADD_COMMENT', payload: { postId, comment } });
	}, []);

	const unlockPost = useCallback((postId: string, userId: string) => {
		dispatch({ type: 'UNLOCK_POST', payload: { postId, userId } });
	}, []);

	const addPost = useCallback((post: Post) => {
		dispatch({ type: 'ADD_POST', payload: post });
	}, []);

	const deletePost = useCallback((postId: string) => {
		dispatch({ type: 'DELETE_POST', payload: postId });
	}, []);

	const subscribe = useCallback((creatorId: string) => {
		dispatch({ type: 'SUBSCRIBE', payload: creatorId });
	}, []);

	const unsubscribe = useCallback((creatorId: string) => {
		dispatch({ type: 'UNSUBSCRIBE', payload: creatorId });
	}, []);

	const isSubscribed = useCallback((creatorId: string) => {
		return state.subscribedCreatorIds.includes(creatorId);
	}, [state.subscribedCreatorIds]);

	const updatePost = useCallback((post: Partial<Post> & { id: string }) => {
		dispatch({ type: 'UPDATE_POST', payload: post });
	}, []);

	return (
		<ContentContext.Provider value={{
			state, toggleLike, addComment, unlockPost, addPost,
			deletePost, subscribe, unsubscribe, isSubscribed, updatePost,
		}}
		>
			{children}
		</ContentContext.Provider>
	);
}

export function useContent() {
	const ctx = useContext(ContentContext);
	if (!ctx) throw new Error('useContent must be used within ContentProvider');
	return ctx;
}
