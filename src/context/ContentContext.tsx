import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { Post, Comment } from '../types';
import { listCreators, type CreatorSummaryDTO } from '../services/ws/services/creator';
import {
	createPost as wsCreatePost,
	deletePost as wsDeletePost,
	likePost as wsLikePost,
	listPosts,
	unlikePost as wsUnlikePost,
	updatePost as wsUpdatePost,
	type PostDTO,
} from '../services/ws/services/posts';
import { useAuth } from './AuthContext';

interface ContentState {
	posts: Post[];
	subscribedCreatorIds: string[];
	creatorsByUserId: Record<string, CreatorSummaryDTO>;
}

type ContentAction =
	| { type: 'SET_CREATORS', payload: Record<string, CreatorSummaryDTO> } |
	{ type: 'SET_POSTS', payload: Post[] } |
	{ type: 'TOGGLE_LIKE', payload: { postId: string, userId: string, liked: boolean, likeCount: number } } |
	{ type: 'ADD_COMMENT', payload: { postId: string, comment: Comment } } |
	{ type: 'UNLOCK_POST', payload: { postId: string, userId: string } } |
	{ type: 'ADD_POST', payload: Post } |
	{ type: 'DELETE_POST', payload: string } |
	{ type: 'SUBSCRIBE', payload: string } |
	{ type: 'UNSUBSCRIBE', payload: string } |
	{ type: 'UPDATE_POST', payload: Partial<Post> & { id: string } };

const initialState: ContentState = {
	posts: [],
	subscribedCreatorIds: [],
	creatorsByUserId: {},
};

function contentReducer(state: ContentState, action: ContentAction): ContentState {
	switch (action.type) {
		case 'SET_CREATORS':
			return { ...state, creatorsByUserId: action.payload };
		case 'SET_POSTS':
			return { ...state, posts: action.payload };
		case 'TOGGLE_LIKE': {
			return {
				...state,
				posts: state.posts.map(p => {
					if (p.id !== action.payload.postId) return p;
					const liked = action.payload.liked;
					return {
						...p,
						likes: action.payload.likeCount,
						likedBy: liked ? [action.payload.userId] : [],
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

function mapPost(dto: PostDTO, creatorsByUserId: Record<string, CreatorSummaryDTO>): Post {
	const creator = creatorsByUserId[dto.user_id];
	const media0 = dto.media[0];

	return {
		id: dto.id,
		creatorId: dto.user_id,
		creatorName: creator?.name ?? `User ${dto.user_id}`,
		creatorAvatar: creator?.avatar_url ?? 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		creatorUsername: creator?.username ?? '',
		type: media0 ? (media0.type === 'video' ? 'video' : 'image') : 'text',
		text: dto.text ?? '',
		mediaUrl: media0?.url,
		thumbnailUrl: undefined,
		isLocked: dto.visibility !== 'public',
		isPPV: dto.visibility === 'ppv',
		ppvPrice: dto.visibility === 'ppv' && dto.ppv_price_usd_cents !== null ? dto.ppv_price_usd_cents / 100 : undefined,
		likes: dto.like_count,
		likedBy: [],
		comments: [],
		createdAt: dto.created_at,
		isPinned: false,
		unlockedBy: [],
	};
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(contentReducer, initialState);
	const { state: authState } = useAuth();

	const toggleLike = useCallback((postId: string, userId: string) => {
		const post = state.posts.find(p => p.id === postId);
		const alreadyLiked = !!post?.likedBy.includes(userId);
		const req = alreadyLiked ? wsUnlikePost(postId) : wsLikePost(postId);
		void req.then(res => {
			dispatch({
				type: 'TOGGLE_LIKE',
				payload: { postId, userId, liked: 'likedByMe' in res ? !!res.likedByMe : !alreadyLiked, likeCount: res.like_count },
			});
		}).catch(() => {
			// ignore; UI stays optimistic-less for now
		});
	}, [state.posts]);

	const addComment = useCallback((postId: string, comment: Comment) => {
		dispatch({ type: 'ADD_COMMENT', payload: { postId, comment } });
	}, []);

	const unlockPost = useCallback((postId: string, userId: string) => {
		dispatch({ type: 'UNLOCK_POST', payload: { postId, userId } });
	}, []);

	const addPost = useCallback((post: Post) => {
		const visibility = post.isPPV ? 'ppv' : post.isLocked ? 'subscribers' : 'public';
		const ppv = post.isPPV ? Math.round((post.ppvPrice ?? 0) * 100) : undefined;
		void wsCreatePost(visibility, post.text, ppv).then(({ post: created }) => {
			dispatch({ type: 'ADD_POST', payload: mapPost(created, state.creatorsByUserId) });
		}).catch(() => {
			// ignore
		});
	}, [state.creatorsByUserId]);

	const deletePost = useCallback((postId: string) => {
		void wsDeletePost(postId).then(() => {
			dispatch({ type: 'DELETE_POST', payload: postId });
		}).catch(() => {
			// ignore
		});
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
		if (typeof post.text === 'string') {
			void wsUpdatePost(post.id, post.text).then(({ post: updated }) => {
				dispatch({ type: 'UPDATE_POST', payload: mapPost(updated, state.creatorsByUserId) });
			}).catch(() => {
				// ignore
			});
			return;
		}
		dispatch({ type: 'UPDATE_POST', payload: post });
	}, [state.creatorsByUserId]);

	useEffect(() => {
		if (!authState.isAuthenticated) return;
		void listCreators(undefined, undefined, 50).then(({ creators }) => {
			const byUserId: Record<string, CreatorSummaryDTO> = {};
			for (const c of creators) byUserId[c.user_id] = c;
			dispatch({ type: 'SET_CREATORS', payload: byUserId });
			return listPosts('feed', 30).then(res => ({ res, byUserId }));
		}).then(res => {
			if (!res) return;
			const posts = res.res.posts.map(p => mapPost(p, res.byUserId));
			dispatch({ type: 'SET_POSTS', payload: posts });
		}).catch(() => {
			// ignore initial load failures
		});
	}, [authState.isAuthenticated]);

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
