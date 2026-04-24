export type WsService = 'sessions' | 'chat';

export type WsIncomingFrame =
	| { kind: 'response', service: string, command: string, requestId: string, payload: unknown }
	| { kind: 'error', service: string, requestId: string, message: string }
	| { kind: 'push', service: string, event: string, payload: unknown };

function safeJsonParse(raw: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return raw;
	}
}

/**
 * Backend protocol (incoming):
 * - Response: |service|command|requestId|<JSON>
 * - Error:    |service|error|requestId|<message>
 * - Push:     |service|event|<JSON>
 */
export function parseIncomingFrame(line: string): WsIncomingFrame | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith('|')) return null;
	const parts = trimmed.split('|');
	// ["", service, commandOrEvent, ...]
	if (parts.length < 4) return null;

	const service = parts[1] ?? '';
	const kindOrName = parts[2] ?? '';

	if (kindOrName === 'error') {
		const requestId = parts[3] ?? '';
		const message = parts.slice(4).join('|');
		return { kind: 'error', service, requestId, message };
	}

	// Response has requestId segment.
	// Push does not.
	if (parts.length >= 5) {
		const requestId = parts[3] ?? '';
		const jsonRaw = parts.slice(4).join('|');
		return { kind: 'response', service, command: kindOrName, requestId, payload: safeJsonParse(jsonRaw) };
	}

	// Push event
	const jsonRaw = parts.slice(3).join('|');
	return { kind: 'push', service, event: kindOrName, payload: safeJsonParse(jsonRaw) };
}

/**
 * Backend protocol (outgoing):
 * SEND: "<service> <requestId> <commandLine>"
 * Example: "sessions s1 /request 42 chat 30"
 */
export function formatOutgoingFrame(service: string, requestId: string, commandLine: string): string {
	return `${service} ${requestId} ${commandLine}`.trim();
}

