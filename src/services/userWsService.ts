import type { WsClient } from './wsClient';
import type { CreatorsMultiplexWs } from './creatorsMultiplexWs';
import type { KycSubmitRequest, KycSubmitResponse } from './kycTypes';
import type { UserAuthenticateResponse, UserMeWsResponse } from './userWsTypes';
import { buildKycSubmitWsArgs } from './kycMap';

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

export function userWsKycSubmitWs(client: WsClient, body: KycSubmitRequest): Promise<KycSubmitResponse> {
	const args = buildKycSubmitWsArgs(body);
	if (args.length < 3) throw new Error('fullName and document asset ids are required');
	return client.request('user', 'kycsubmit', args) as Promise<KycSubmitResponse>;
}

export function userWsKycSubmitMultiplex(client: CreatorsMultiplexWs, body: KycSubmitRequest): Promise<KycSubmitResponse> {
	const args = buildKycSubmitWsArgs(body);
	if (args.length < 3) throw new Error('fullName and document asset ids are required');
	const cmd = `/kycsubmit ${args.join(' ')}`;
	return client.send('user', cmd).then(json => json as KycSubmitResponse);
}
