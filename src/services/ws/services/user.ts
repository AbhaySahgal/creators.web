import { wsClient } from '../client';
import { makeRequestId } from '../requestId';

export function authenticate(jwt: string) {
	const reqId = makeRequestId('u');
	return wsClient.request<{ ok: true, user_id: string }>('user', reqId, `/authenticate ${jwt}`);
}

export function me() {
	const reqId = makeRequestId('u');
	return wsClient.request<{ id: string, email: string, display_name: string, role: 'fan' | 'creator' | 'admin', created_at: string }>('user', reqId, '/me');
}
