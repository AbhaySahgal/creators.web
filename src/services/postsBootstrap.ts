import type { Post } from '../types';

export const CATALOG_HYDRATE_CONCURRENCY = 5;
export const MAX_DISCOVER_CREATORS = 25;

export function uniqueCreatorIds(ids: string[]): string[] {
	const out: string[] = [];
	const seen: Record<string, boolean> = {};
	for (const id of ids) {
		const t = String(id ?? '').trim();
		if (!t || seen[t]) continue;
		seen[t] = true;
		out.push(t);
	}
	return out;
}

export function creatorIdsFromPostIds(postIds: string[], posts: Post[]): string[] {
	const ids: string[] = [];
	for (const pid of postIds) {
		const p = posts.find(x => x.id === pid);
		if (p?.creatorId) ids.push(p.creatorId);
	}
	return uniqueCreatorIds(ids);
}

/** Merge list-order posts with full catalogs for hydrated creators (PPV/subscriber teasers). */
export function mergeDisplayPosts(
	orderedPostIds: string[],
	allPosts: Post[],
	hydratedCreatorIds: string[]
): Post[] {
	const byId: Record<string, Post> = {};
	for (const pid of orderedPostIds) {
		const p = allPosts.find(x => x.id === pid);
		if (p) byId[p.id] = p;
	}
	for (const p of allPosts) {
		if (!hydratedCreatorIds.includes(p.creatorId)) continue;
		if (!byId[p.id]) byId[p.id] = p;
	}
	return Object.values(byId).sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
}

export function runBatched<T>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<void>
): Promise<void> {
	const limit = Math.max(1, concurrency);
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += limit) {
		chunks.push(items.slice(i, i + limit));
	}
	return chunks.reduce(
		(chain, chunk) => chain.then(() => Promise.all(chunk.map(item => fn(item)))).then(() => {}),
		Promise.resolve()
	);
}
