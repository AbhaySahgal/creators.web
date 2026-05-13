/**
 * Map low-level backend / DB errors to clearer copy for end users.
 * (The real fix for Postgres auth is always server configuration.)
 */
export function humanizeWsBackendError(message: string): string {
	const m = message.trim();
	if (/password authentication failed for user ["']?postgres["']?/i.test(m)) {
		return 'The service cannot reach its database right now. This is a server-side issue—try again later or ask the backend team to fix PostgreSQL credentials.';
	}
	if (/postgres/i.test(m) && /password authentication failed/i.test(m)) {
		return 'The service cannot reach its database right now. Please try again later or contact support.';
	}
	return m;
}
