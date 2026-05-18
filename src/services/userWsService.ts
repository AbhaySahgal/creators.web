import type {
	DeleteRequestResponse,
	DeleteStatusResponse,
	DeleteVerifyResponse,
	ExportDataResponse,
} from './accountTypes';
import type { CreatorsMultiplexWs } from './creatorsMultiplexWs';
import type { WsClient } from './wsClient';
import type { UserAuthenticateResponse, UserMeWsResponse } from './userWsTypes';

function assertRequestIdTag(tag?: string): string | undefined {
	if (tag === undefined) return undefined;
	const t = tag.trim();
	if (!t) return undefined;
	if (/\s/.test(t)) throw new Error('requestId must not contain spaces');
	return t;
}

function assertVerifyCode(code: string): string {
	const c = String(code ?? '').trim();
	if (!c) throw new Error('Verification code is required');
	if (/\s/.test(c)) throw new Error('Verification code must not contain spaces');
	return c;
}

/** Bind JWT on an existing guest socket (token must be compact / no spaces). */
export function userWsAuthenticate(client: CreatorsMultiplexWs, jwt: string): Promise<UserAuthenticateResponse> {
	const t = jwt.trim();
	if (!t || t.includes(' ')) {
		return Promise.reject(new Error('Invalid JWT for WebSocket /authenticate'));
	}
	return client.send('user', `/authenticate ${t}`).then(json => json as UserAuthenticateResponse);
}

export function userWsMe(client: CreatorsMultiplexWs): Promise<UserMeWsResponse> {
	return client.send('user', '/me').then(json => json as UserMeWsResponse);
}

export function userWsLogout(client: CreatorsMultiplexWs): Promise<void> {
	return client.send('user', '/logout').then(() => {});
}

/** B9: `user /deleterequest` */
export function userWsDeleteRequest(ws: WsClient, requestIdTag?: string): Promise<DeleteRequestResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	return ws.request('user', 'deleterequest', [], rid).then(json => json as DeleteRequestResponse);
}

/** B9: `user /deleteverify <code>` */
export function userWsDeleteVerify(ws: WsClient, code: string, requestIdTag?: string): Promise<DeleteVerifyResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	const c = assertVerifyCode(code);
	return ws.request('user', 'deleteverify', [c], rid).then(json => json as DeleteVerifyResponse);
}

/** B9: `user /deletestatus` */
export function userWsDeleteStatus(ws: WsClient, requestIdTag?: string): Promise<DeleteStatusResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	return ws.request('user', 'deletestatus', [], rid).then(json => json as DeleteStatusResponse);
}

/** B9: `user /export` */
export function userWsExport(ws: WsClient, requestIdTag?: string): Promise<ExportDataResponse> {
	const rid = assertRequestIdTag(requestIdTag);
	return ws.request('user', 'export', [], rid).then(json => json as ExportDataResponse);
}
