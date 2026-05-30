import { apiErrorMessage, creatorsApi } from './creatorsApi';
import { createPaymentWs } from './paymentWs';
import { postsGet, postsUnlock } from './postsWsService';
import type { PostDTO } from './postsTypes';
import type { WsClient } from './wsClient';

export interface PpvUnlockResult {
	post: PostDTO;
	fromBalanceAfter: string;
	alreadyOwned: boolean;
}

export interface PpvServiceOpts {
	ws?: WsClient | null;
	wsConnected?: boolean;
	wsAuthReady?: boolean;
}

function assertPostId(postId: string): string {
	const id = postId.trim();
	if (!id) throw new Error('Post id is required');
	return id;
}

export function fetchPost(postId: string, opts?: PpvServiceOpts): Promise<PostDTO> {
	const id = assertPostId(postId);
	const ws = opts?.ws;
	if (ws?.isConnected && opts?.wsAuthReady) {
		return postsGet(ws, id).then(r => r.post);
	}
	return Promise.reject(new Error('WebSocket required to fetch post'));
}

export function unlockPpvPostFromWallet(
	postId: string,
	opts?: PpvServiceOpts & { idempotencyKey?: string }
): Promise<PpvUnlockResult> {
	const id = assertPostId(postId);
	const ws = opts?.ws;
	const canWs = Boolean(ws?.isConnected && opts?.wsAuthReady);

	if (canWs && ws) {
		return postsUnlock(ws, id)
			.then(res => ({
				post: res.post,
				fromBalanceAfter: res.from_balance_after,
				alreadyOwned: res.already_owned,
			}))
			.catch(err => {
				const msg = apiErrorMessage(err, '');
				if (msg.toLowerCase().includes('insufficient')) {
					return unlockViaPaymentPpvunlock(id, opts);
				}
				throw err;
			});
	}

	return unlockViaHttp(id, opts?.idempotencyKey);
}

function unlockViaPaymentPpvunlock(
	postId: string,
	opts?: PpvServiceOpts & { idempotencyKey?: string }
): Promise<PpvUnlockResult> {
	const ws = opts?.ws;
	if (!ws?.isConnected || !opts?.wsAuthReady) {
		return unlockViaHttp(postId, opts?.idempotencyKey);
	}
	const payment = createPaymentWs(ws);
	return payment.ppvUnlock(postId, opts?.idempotencyKey).then(res =>
		refreshPostAfterPaymentUnlock(postId, res.from_balance_after, res.already_owned, opts)
	);
}

function unlockViaHttp(postId: string, idempotencyKey?: string): Promise<PpvUnlockResult> {
	return creatorsApi.payments
		.ppvUnlock({ postId, ...(idempotencyKey ? { idempotencyKey } : {}) })
		.then(res => {
			if (res.post?.id) {
				return {
					post: res.post,
					fromBalanceAfter: res.from_balance_after,
					alreadyOwned: res.already_owned === true,
				};
			}
			const after = res.from_balance_after;
			const ws = undefined;
			return refreshPostAfterPaymentUnlock(postId, after, res.already_owned === true, { ws });
		});
}

function refreshPostAfterPaymentUnlock(
	postId: string,
	fromBalanceAfter: string,
	alreadyOwned: boolean,
	opts?: PpvServiceOpts
): Promise<PpvUnlockResult> {
	const ws = opts?.ws;
	if (ws?.isConnected && opts?.wsAuthReady) {
		return postsGet(ws, postId).then(({ post }) => ({ post, fromBalanceAfter, alreadyOwned }));
	}
	return Promise.reject(new Error('Post unlocked but could not refresh post (WebSocket unavailable)'));
}

export function shareErrorMessage(err: unknown, fallback: string): string {
	return apiErrorMessage(err, fallback);
}
