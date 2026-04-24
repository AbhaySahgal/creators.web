export class HttpError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(message: string, status: number, body: unknown) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.body = body;
	}
}

export function isHttpError(err: unknown): err is HttpError {
	return err instanceof HttpError;
}
