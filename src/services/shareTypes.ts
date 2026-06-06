export type ShareTargetType = 'post' | 'live';

/** B5 GET /share — author block. */
export interface ShareAuthor {
	name?: string;
	username?: string;
	avatarUrl?: string;
}

/** B5 GET /share/:type/:id response (fields only). */
export interface ShareMetadata {
	type: ShareTargetType;
	id: string;
	title?: string;
	description?: string;
	imageUrl?: string;
	author?: ShareAuthor;
}

export interface ShareEventRequest {
	targetType: ShareTargetType;
	targetId: string;
	channel?: string;
}

export interface ShareEventResponse {
	ok: true;
}

function coerceId(v: unknown): string {
	if (typeof v === 'string') return v.trim();
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return '';
}

function coerceOptionalString(v: unknown): string | undefined {
	if (typeof v !== 'string') return undefined;
	const t = v.trim();
	return t || undefined;
}

function parseShareTargetType(v: unknown): ShareTargetType | null {
	if (v === 'post' || v === 'live') return v;
	return null;
}

function parseShareAuthor(v: unknown): ShareAuthor | undefined {
	if (!v || typeof v !== 'object') return undefined;
	const o = v as Record<string, unknown>;
	const name = coerceOptionalString(o.name);
	const username = coerceOptionalString(o.username);
	const avatarUrl = coerceOptionalString(o.avatar_url);
	if (!name && !username && !avatarUrl) return undefined;
	return { name, username, avatarUrl };
}

export function parseShareMetadata(
	json: unknown,
	requestedType: ShareTargetType,
	requestedId: string
): ShareMetadata | null {
	if (!json || typeof json !== 'object') return null;
	const obj = json as Record<string, unknown>;

	const type = parseShareTargetType(obj.type);
	const id = coerceId(obj.id);
	if (!type || !id) return null;
	if (type !== requestedType || id !== requestedId) return null;

	return {
		type,
		id,
		title: coerceOptionalString(obj.title),
		description: coerceOptionalString(obj.description),
		imageUrl: coerceOptionalString(obj.image_url),
		author: parseShareAuthor(obj.author),
	};
}

export function normalizeShareEventRequest(body: ShareEventRequest): ShareEventRequest {
	const targetType = parseShareTargetType(body.targetType);
	const targetId = coerceId(body.targetId);
	if (!targetType || !targetId) {
		throw new Error('targetType and targetId are required');
	}
	const channel = coerceOptionalString(body.channel);
	return { targetType, targetId, ...(channel ? { channel } : {}) };
}

export function parseShareEventResponse(json: unknown): ShareEventResponse | null {
	if (json && typeof json === 'object' && (json as Record<string, unknown>).ok === true) {
		return { ok: true };
	}
	return null;
}
