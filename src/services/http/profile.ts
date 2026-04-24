import type { User } from '../../types';
import { postJson } from './client';

export interface UpdateProfileRequest {
	name?: string;
	username?: string;
	avatarAssetId?: string;
	avatarUrl?: string;
	bio?: string;
	bannerAssetId?: string;
	bannerUrl?: string;
	category?: string;
}

export function updateProfile(body: UpdateProfileRequest): Promise<{ user: User }> {
	return postJson<{ user: User }>('/me/profile', body, { auth: true });
}
