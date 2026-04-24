import { getWsBaseUrl } from '../http/env';

export type WsServiceName = 'user' | 'posts' | 'creator' | 'chat' | 'call' | 'payment' | 'sessions';

export interface WsSuccessFrame {
	service: WsServiceName;
	kind: 'success';
	command: string;
	requestId: string;
	body: unknown;
}

export interface WsErrorFrame {
	service: WsServiceName;
	kind: 'error';
	requestId: string;
	message: string;
}

export interface WsEventFrame {
	service: WsServiceName;
	kind: 'event';
	event: string;
	body: unknown;
}

export type WsFrame = WsSuccessFrame | WsErrorFrame | WsEventFrame;

type FrameListener = (frame: WsFrame) => void;

function safeJsonParse(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function appendToken(url: string, token: string | null): string {
	if (!token) return url;
	const u = new URL(url);
	u.searchParams.set('token', token);
	return u.toString();
}

function normalizeLine(line: string): string {
	return line.endsWith('\n') ? line : `${line}\n`;
}

function parseFrame(raw: string): WsFrame | null {
	// success: |service|command|requestId|<json>
	// error:   |service|error|requestId|message
	// event:   |service|event|<json> (no requestId)
	if (!raw.startsWith('|')) return null;
	const parts = raw.split('|');
	// ['', service, commandOrErrorOrEvent, ...]
	if (parts.length < 4) return null;
	const service = parts[1] as WsServiceName;
	const tag = parts[2];

	if (tag === 'error') {
		const requestId = parts[3] ?? '';
		const message = parts.slice(4).join('|') || 'Unknown error';
		return { service, kind: 'error', requestId, message };
	}

	// success frame needs requestId + json
	if (parts.length >= 5) {
		const command = tag;
		const requestId = parts[3] ?? '';
		const bodyText = parts.slice(4).join('|');
		return { service, kind: 'success', command, requestId, body: safeJsonParse(bodyText) };
	}

	// event: |service|event|json
	const event = tag;
	const bodyText = parts.slice(3).join('|');
	return { service, kind: 'event', event, body: safeJsonParse(bodyText) };
}

export class WsLineClient {
	private socket: WebSocket | null = null;
	private token: string | null = null;
	private listeners: FrameListener[] = [];
	private pending: Record<string, { resolve: (v: unknown) => void, reject: (e: unknown) => void, service: WsServiceName, command: string }> = {};
	private connectPromise: Promise<void> | null = null;

	setToken(token: string | null) {
		if (this.token === token) return;
		this.token = token;
		this.close();
	}

	subscribe(listener: FrameListener): () => void {
		this.listeners = [...this.listeners, listener];
		return () => {
			this.listeners = this.listeners.filter(l => l !== listener);
		};
	}

	private emit(frame: WsFrame) {
		for (const l of this.listeners) l(frame);
	}

	private ensureConnected(): Promise<void> {
		if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
		if (this.connectPromise) return this.connectPromise;

		this.connectPromise = new Promise<void>((resolve, reject) => {
			const url = appendToken(getWsBaseUrl(), this.token);
			const ws = new WebSocket(url);
			this.socket = ws;

			const onOpen = () => {
				this.connectPromise = null;
				resolve();
			};

			const onError = () => {
				// let close handler reject if needed
			};

			const onClose = () => {
				this.socket = null;
				const err = new Error('WebSocket disconnected');
				for (const requestId of Object.keys(this.pending)) {
					this.pending[requestId]?.reject(err);
					delete this.pending[requestId];
				}
				if (this.connectPromise) {
					this.connectPromise = null;
					reject(err);
				}
			};

			const onMessage = (ev: MessageEvent) => {
				const text = typeof ev.data === 'string' ? ev.data : '';
				const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
				for (const line of lines) {
					const frame = parseFrame(line);
					if (!frame) continue;

					if (frame.kind === 'success') {
						const p = this.pending[frame.requestId];
						if (p?.service === frame.service && p?.command === frame.command) {
							delete this.pending[frame.requestId];
							p.resolve(frame.body);
						}
					} else if (frame.kind === 'error') {
						const p = this.pending[frame.requestId];
						if (p) {
							delete this.pending[frame.requestId];
							p.reject(new Error(frame.message));
						}
					}

					this.emit(frame);
				}
			};

			ws.addEventListener('open', onOpen);
			ws.addEventListener('error', onError);
			ws.addEventListener('close', onClose);
			ws.addEventListener('message', onMessage);
		});

		return this.connectPromise;
	}

	close() {
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore
			}
		}
		this.socket = null;
		this.connectPromise = null;
	}

	request<T = unknown>(service: WsServiceName, requestId: string, commandLine: string): Promise<T> {
		return this.ensureConnected().then(() => {
			if (this.socket?.readyState !== WebSocket.OPEN) {
				throw new Error('WebSocket not connected');
			}

			const command = commandLine.trim().split(/\s+/)[0]?.replace(/^\//, '') || '';
			const promise = new Promise<T>((resolve, reject) => {
				this.pending[requestId] = {
					resolve: v => resolve(v as T),
					reject,
					service,
					command,
				};
			});

			// Always select service with the requestId for correlation
			this.socket.send(normalizeLine(`> ${service} ${requestId}`));
			this.socket.send(normalizeLine(commandLine.startsWith('/') ? commandLine : `/${commandLine}`));
			return promise;
		});
	}
}
