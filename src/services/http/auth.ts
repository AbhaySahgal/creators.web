import type { User } from '../../types';
import { getJson, postJson } from './client';

export interface RegisterRequest {
	email: string;
	password: string;
	displayName: string;
}

export interface AuthTokenResponse {
	token: string;
	userId: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface FirebaseExchangeRequest {
	idToken: string;
	preferredRole?: 'fan' | 'creator';
}

export interface FirebaseExchangeResponse {
	user: User;
	userId: string;
	role: 'fan' | 'creator' | 'admin';
	token: string;
}

export interface MeResponse {
	user: User | null;
}

export function register(req: RegisterRequest): Promise<AuthTokenResponse> {
	return postJson<AuthTokenResponse>('/auth/register', req);
}

export function login(req: LoginRequest): Promise<AuthTokenResponse> {
	return postJson<AuthTokenResponse>('/auth/login', req);
}

export function exchangeFirebase(req: FirebaseExchangeRequest): Promise<FirebaseExchangeResponse> {
	return postJson<FirebaseExchangeResponse>('/auth/firebase/exchange', req);
}

export function getMe(): Promise<MeResponse> {
	return getJson<MeResponse>('/me', { auth: true });
}

export function logout(): Promise<{ ok: true }> {
	return postJson<{ ok: true }>('/logout', undefined, { auth: true });
}
