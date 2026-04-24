import { formatOutgoingFrame, parseIncomingFrame, type WsIncomingFrame } from './lineProtocol';

export type WsMuxEventHandler = (payload: unknown) => void;

type PendingRequest = {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
	timeoutId: ReturnType<typeof setTimeout> | null;
};

export class WsMuxClient {
	private ws: WebSocket | null = null;

	private requestSeq = 0;
	private pending = new Map<string, PendingRequest>();
	private eventHandlers = new Map<string, Set<WsMuxEventHandler>>(); // key: `${service}:${event}`

	connect(url: string) {
		if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
		this.ws = new WebSocket(url);

		this.ws.addEventListener('message', evt => {
			const raw = typeof evt.data === 'string' ? evt.data : '';
			raw.split('\n').forEach(line => {
				const frame = parseIncomingFrame(line);
				if (!frame) return;
				this.handleFrame(frame);
			});
		});

		this.ws.addEventListener('close', () => {
			this.ws = null;
		});

		this.ws.addEventListener('error', () => {
			// Browser WebSocket errors do not provide details; close and let higher layer reconnect.
		});
	}

	close() {
		if (this.ws) {
			try { this.ws.close(); } catch { /* noop */ }
		}
		this.ws = null;
		this.flushPending(new Error('WebSocket closed'));
	}

	getReadyState(): number {
		return this.ws?.readyState ?? WebSocket.CLOSED;
	}

	createRequestId(prefix: string): string {
		this.requestSeq += 1;
		return `${prefix}${this.requestSeq}`;
	}

	on(service: string, event: string, handler: WsMuxEventHandler): () => void {
		const key = `${service}:${event}`;
		const set = this.eventHandlers.get(key) ?? new Set<WsMuxEventHandler>();
		set.add(handler);
		this.eventHandlers.set(key, set);
		return () => {
			const current = this.eventHandlers.get(key);
			if (!current) return;
			current.delete(handler);
			if (current.size === 0) this.eventHandlers.delete(key);
		};
	}

	sendRequest(service: string, commandLine: string, opts?: { requestId?: string, timeoutMs?: number }): Promise<unknown> {
		const requestId = opts?.requestId ?? this.createRequestId(service[0] ?? 'r');
		const timeoutMs = opts?.timeoutMs ?? 15000;

		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('WebSocket is not connected'));
		}

		const frame = formatOutgoingFrame(service, requestId, commandLine);
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error(`Request timed out (${service} ${requestId})`));
			}, timeoutMs);

			this.pending.set(requestId, { resolve, reject, timeoutId });
			try {
				this.ws!.send(frame);
			} catch (err) {
				clearTimeout(timeoutId);
				this.pending.delete(requestId);
				reject(err instanceof Error ? err : new Error('Failed to send WebSocket message'));
			}
		});
	}

	private handleFrame(frame: WsIncomingFrame) {
		if (frame.kind === 'response') {
			const pending = this.pending.get(frame.requestId);
			if (!pending) return;
			if (pending.timeoutId) clearTimeout(pending.timeoutId);
			this.pending.delete(frame.requestId);
			pending.resolve(frame.payload);
			return;
		}

		if (frame.kind === 'error') {
			const pending = this.pending.get(frame.requestId);
			if (pending) {
				if (pending.timeoutId) clearTimeout(pending.timeoutId);
				this.pending.delete(frame.requestId);
				pending.reject(new Error(frame.message));
			}
			return;
		}

		if (frame.kind === 'push') {
			const key = `${frame.service}:${frame.event}`;
			const handlers = this.eventHandlers.get(key);
			if (!handlers) return;
			handlers.forEach(h => h(frame.payload));
		}
	}

	private flushPending(err: Error) {
		this.pending.forEach(p => {
			if (p.timeoutId) clearTimeout(p.timeoutId);
			p.reject(err);
		});
		this.pending.clear();
	}
}

