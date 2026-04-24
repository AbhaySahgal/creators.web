import { getAccessToken } from '../auth/tokenStore';
import { WsLineClient } from './WsLineClient';

export const wsClient = new WsLineClient();

export function syncWsTokenFromStorage() {
	wsClient.setToken(getAccessToken());
}
