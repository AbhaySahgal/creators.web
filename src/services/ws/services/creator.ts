import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export interface CreatorSummaryDTO {
	id: string;
	user_id: string;
	username: string;
	name: string;
	avatar_url: string | null;
	categories: string[];
}

export interface CreatorProfileDTO extends CreatorSummaryDTO {
	bio: string | null;
	banner_url: string | null;
	socials: Record<string, unknown> | null;
	created_at: string;
}

export function listCreators(q?: string, category?: string, limit?: number, beforeCursor?: string) {
	const reqId = makeRequestId('c');
	const args: string[] = ['/list'];
	if (q) args.push(q);
	if (category) args.push(category);
	if (limit) args.push(String(limit));
	if (beforeCursor) args.push(beforeCursor);
	return wsClient.request<{ creators: CreatorSummaryDTO[], nextCursor: string | null }>('creator', reqId, args.join(' '));
}

export function getCreator(creatorId: string) {
	const reqId = makeRequestId('c');
	return wsClient.request<{ creator: CreatorProfileDTO | null }>('creator', reqId, `/get ${creatorId}`);
}

export function upsertProfile(username: string, name: string, bio?: string) {
	const reqId = makeRequestId('c');
	const args: string[] = ['/upsertprofile', username, name];
	if (bio) args.push(bio);
	return wsClient.request<{ creator: CreatorProfileDTO }>('creator', reqId, args.join(' '));
}
