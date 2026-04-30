export type WsFrame =
	{ type: 'event', service: string, event: string, data: unknown } |
	{ type: 'response', service: string, command: string, requestId: string, data: unknown } |
	{ type: 'error', service: string, requestId: string, message: string };

function unescapePipes(value: string): string {
	return value.replace(/\\\|/g, '|');
}

export function parseFrame(raw: string): WsFrame | null {
	if (!raw.startsWith('|')) return null;
	const parts = raw.split('|');

	// Event: |service|event|json  => split gives ["", service, event, json...]
	// JSON can contain pipes inside string values, so tolerate extra split parts.
	if (parts.length >= 4 && parts[3] !== undefined && parts[2] !== 'error') {
		const service = parts[1] ?? '';
		const event = parts[2] ?? '';
		const json = parts.slice(3).join('|');
		try {
			return { type: 'event', service, event, data: JSON.parse(json) };
		} catch {
			// fall through to response/error parsing
		}
	}

	// Response: |service|command|requestId|json => ["", service, command, requestId, json]
	// Error:    |service|error|requestId|message
	if (parts.length >= 5) {
		const service = parts[1] ?? '';
		const kind = parts[2] ?? '';
		const requestId = parts[3] ?? '';
		const payload = parts.slice(4).join('|');
		if (kind === 'error') {
			return { type: 'error', service, requestId, message: unescapePipes(payload) };
		}
		try {
			return { type: 'response', service, command: kind, requestId, data: JSON.parse(payload) };
		} catch {
			return null;
		}
	}

	return null;
}

export function formatServiceLine(service: string, requestId?: string): string {
	const s = service.trim();
	return requestId ? `> ${s} ${requestId}` : `> ${s}`;
}

export function formatCommandLine(command: string, args: string[] = []): string {
	const joined = args.length > 0 ? ` ${args.join(' ')}` : '';
	const trimmed = command.trim();
	// Many call sites pass commands with a leading `/` (e.g. `/list feed 30`).
	// Avoid turning it into `//list feed 30`.
	if (trimmed.startsWith('/')) return `${trimmed}${joined}`;
	return `/${trimmed}${joined}`;
}
