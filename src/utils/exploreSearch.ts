/** Case-insensitive substring match for Explore client-side search. */
export function matchesExploreQuery(
	q: string,
	...fields: (string | null | undefined)[]
): boolean {
	const needle = q.trim().toLowerCase();
	if (!needle) return true;
	return fields.some(f => (f ?? '').toLowerCase().includes(needle));
}
