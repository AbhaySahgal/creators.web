import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import type { User, Creator } from '../types';
import { firebaseMissingConfigKeys, isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth, getGoogleProvider } from '../lib/firebaseClient';
import { exchangeFirebaseToken } from '../services/authApi';
import { clearAccessToken, getAccessToken, setAccessToken } from '../services/auth/tokenStore';
import { syncWsTokenFromStorage } from '../services/ws/client';
import * as authHttp from '../services/http/auth';
import { isHttpError } from '../services/http/errors';

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	isAgeVerified: boolean;
	pendingEmail: string;
	loginError: string;
	creatorProfiles: Record<string, Creator>;
}

type AuthAction =
	| { type: 'LOGIN', payload: User } |
	{ type: 'LOGOUT' } |
	{ type: 'SET_AGE_VERIFIED' } |
	{ type: 'SET_PENDING_EMAIL', payload: string } |
	{ type: 'SET_ERROR', payload: string } |
	{ type: 'CLEAR_ERROR' } |
	{ type: 'UPDATE_USER', payload: Partial<User> } |
	{ type: 'UPDATE_WALLET', payload: number } |
	{ type: 'UPDATE_CREATOR_PROFILE', payload: Partial<Creator> };

const initialState: AuthState = {
	user: null,
	isAuthenticated: false,
	isAgeVerified: false,
	pendingEmail: '',
	loginError: '',
	creatorProfiles: {},
};

function createCreatorProfileFromUser(user: User): Creator {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		username: user.username,
		avatar: user.avatar,
		role: 'creator',
		createdAt: user.createdAt,
		isAgeVerified: user.isAgeVerified,
		status: user.status,
		walletBalance: user.walletBalance,
		bio: 'Tell fans about your content and what they can expect.',
		banner: 'https://images.pexels.com/photos/3756766/pexels-photo-3756766.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop',
		subscriptionPrice: 9.99,
		totalEarnings: 0,
		monthlyEarnings: 0,
		tipsReceived: 0,
		subscriberCount: 0,
		kycStatus: 'not_submitted',
		isKYCVerified: false,
		category: 'Lifestyle',
		isOnline: false,
		postCount: 0,
		likeCount: 0,
		monthlyStats: [],
		perMinuteRate: 2.99,
		liveStreamEnabled: false,
	};
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
	switch (action.type) {
		case 'LOGIN':
			return { ...state, user: action.payload, isAuthenticated: true, loginError: '' };
		case 'LOGOUT':
			return { ...initialState };
		case 'SET_AGE_VERIFIED':
			return { ...state, isAgeVerified: true };
		case 'SET_PENDING_EMAIL':
			return { ...state, pendingEmail: action.payload };
		case 'SET_ERROR':
			return { ...state, loginError: action.payload };
		case 'CLEAR_ERROR':
			return { ...state, loginError: '' };
		case 'UPDATE_USER':
			if (!state.user) return state;
			return {
				...state,
				user: { ...state.user, ...action.payload },
				creatorProfiles: state.user.role === 'creator' && state.creatorProfiles[state.user.id] ?
					{
						...state.creatorProfiles,
						[state.user.id]: {
							...state.creatorProfiles[state.user.id],
							...action.payload,
						},
					} :
					state.creatorProfiles,
			};
		case 'UPDATE_WALLET':
			return {
				...state,
				user: state.user ? { ...state.user, walletBalance: action.payload } : null,
				creatorProfiles: state.user?.role === 'creator' && state.creatorProfiles[state.user.id] ?
					{
						...state.creatorProfiles,
						[state.user.id]: {
							...state.creatorProfiles[state.user.id],
							walletBalance: action.payload,
						},
					} :
					state.creatorProfiles,
			};
		case 'UPDATE_CREATOR_PROFILE':
			if (state.user?.role !== 'creator') return state;
			return {
				...state,
				creatorProfiles: {
					...state.creatorProfiles,
					[state.user.id]: {
						...(state.creatorProfiles[state.user.id] ?? createCreatorProfileFromUser(state.user)),
						...action.payload,
						id: state.user.id,
					},
				},
			};
		default:
			return state;
	}
}

interface AuthContextValue {
	state: AuthState;
	login: (email: string, password: string) => Promise<User | null>;
	register: (email: string, password: string, displayName: string, desiredRole?: 'fan' | 'creator') => Promise<User | null>;
	loginWithGoogle: (preferredRole?: 'fan' | 'creator') => Promise<User | null>;
	logout: () => void;
	verifyAge: () => void;
	setPendingEmail: (email: string) => void;
	updateUser: (data: Partial<User>) => void;
	updateCreatorProfile: (data: Partial<Creator>) => void;
	updateWallet: (amount: number) => void;
	clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUsername(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 20) || 'user';
}

function normalizeApiUser(apiUser: User): User {
	return {
		...apiUser,
		avatar: apiUser.avatar || 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		username: apiUser.username || normalizeUsername(apiUser.name || apiUser.email),
	};
}

function createFallbackGoogleUser(firebaseUser: FirebaseUser, preferredRole: 'fan' | 'creator'): User {
	const email = firebaseUser.email ?? '';
	const displayName = firebaseUser.displayName?.trim() || email.split('@')[0] || 'New User';

	return {
		id: `google-${firebaseUser.uid}`,
		email,
		name: displayName,
		username: normalizeUsername(displayName || email),
		avatar: firebaseUser.photoURL ?? 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
		role: preferredRole,
		createdAt: new Date().toISOString(),
		isAgeVerified: true,
		status: 'active',
		walletBalance: 0,
	};
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(authReducer, initialState);

	const login = useCallback((email: string, password: string): Promise<User | null> => {
		dispatch({ type: 'CLEAR_ERROR' });
		return authHttp.login({ email, password }).then(({ token }) => {
			setAccessToken(token);
			syncWsTokenFromStorage();
			return authHttp.getMe();
		}).then(({ user }) => {
			if (!user) throw new Error('Login succeeded but user is null');
			const normalized = normalizeApiUser(user);
			dispatch({ type: 'LOGIN', payload: normalized });
			return normalized;
		}).catch(err => {
			if (isHttpError(err) && err.status === 401) {
				dispatch({ type: 'SET_ERROR', payload: 'Invalid email or password.' });
				return null;
			}
			const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
			dispatch({ type: 'SET_ERROR', payload: message });
			return null;
		});
	}, []);

	const register = useCallback((
		email: string,
		password: string,
		displayName: string,
		desiredRole: 'fan' | 'creator' = 'fan'
	): Promise<User | null> => {
		dispatch({ type: 'CLEAR_ERROR' });
		return authHttp.register({ email, password, displayName }).then(({ token }) => {
			setAccessToken(token);
			syncWsTokenFromStorage();
			return authHttp.getMe();
		}).then(({ user }) => {
			if (!user) throw new Error('Registration succeeded but user is null');
			const normalized = normalizeApiUser(user);
			dispatch({ type: 'LOGIN', payload: normalized });
			if (desiredRole === 'creator') {
				// Backend promotes to creator via creator service upsertprofile; UI may trigger this later.
				dispatch({ type: 'UPDATE_CREATOR_PROFILE', payload: createCreatorProfileFromUser(normalized) });
			}
			return normalized;
		}).catch(err => {
			const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
			dispatch({ type: 'SET_ERROR', payload: message });
			return null;
		});
	}, []);

	const loginWithGoogle = useCallback((preferredRole: 'fan' | 'creator' = 'fan'): Promise<User | null> => {
		dispatch({ type: 'CLEAR_ERROR' });

		if (!isFirebaseConfigured) {
			dispatch({
				type: 'SET_ERROR',
				payload: `Google sign-in is unavailable. Missing env keys: ${firebaseMissingConfigKeys.join(', ')}`,
			});
			return Promise.resolve(null);
		}

		const auth = getFirebaseAuth();
		const provider = getGoogleProvider();
		return signInWithPopup(auth, provider).then(credential => (
			credential.user.getIdToken().then(idToken => (
				exchangeFirebaseToken(idToken, preferredRole).then(result => {
					const resolvedUser = result?.user ?? createFallbackGoogleUser(credential.user, preferredRole);
					if (result?.token) {
						setAccessToken(result.token);
						syncWsTokenFromStorage();
					}
					dispatch({ type: 'LOGIN', payload: normalizeApiUser(resolvedUser) });
					return resolvedUser;
				})
			))
		)).catch(error => {
			const message = error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
			dispatch({ type: 'SET_ERROR', payload: message });
			return null;
		});
	}, []);

	const logout = useCallback(() => {
		void authHttp.logout().catch(() => {
			// Stateless logout: ignore failures.
		});
		clearAccessToken();
		syncWsTokenFromStorage();
		dispatch({ type: 'LOGOUT' });

		if (!isFirebaseConfigured) return;
		void firebaseSignOut(getFirebaseAuth()).catch(() => {
			// Keep logout resilient even if Firebase session clear fails.
		});
	}, []);

	const verifyAge = useCallback(() => {
		dispatch({ type: 'SET_AGE_VERIFIED' });
	}, []);

	const setPendingEmail = useCallback((email: string) => {
		dispatch({ type: 'SET_PENDING_EMAIL', payload: email });
	}, []);

	const updateUser = useCallback((data: Partial<User>) => {
		dispatch({ type: 'UPDATE_USER', payload: data });
	}, []);

	const updateCreatorProfile = useCallback((data: Partial<Creator>) => {
		dispatch({ type: 'UPDATE_CREATOR_PROFILE', payload: data });
	}, []);

	const updateWallet = useCallback((amount: number) => {
		dispatch({ type: 'UPDATE_WALLET', payload: amount });
	}, []);

	const clearError = useCallback(() => {
		dispatch({ type: 'CLEAR_ERROR' });
	}, []);

	useEffect(() => {
		const token = getAccessToken();
		if (!token) return;
		syncWsTokenFromStorage();
		void authHttp.getMe().then(({ user }) => {
			if (user) dispatch({ type: 'LOGIN', payload: normalizeApiUser(user) });
		}).catch(() => {
			// Token invalid/expired: drop it silently.
			clearAccessToken();
			syncWsTokenFromStorage();
		});
	}, []);

	return (
		<AuthContext.Provider
			value={{
				state,
				login,
				register,
				loginWithGoogle,
				logout,
				verifyAge,
				setPendingEmail,
				updateUser,
				updateCreatorProfile,
				updateWallet,
				clearError,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}

export function useCurrentCreator(): Creator | null {
	const { state } = useAuth();
	const currentUser = state.user;
	if (currentUser?.role !== 'creator') return null;
	return state.creatorProfiles[currentUser.id] ?? createCreatorProfileFromUser(currentUser);
}
