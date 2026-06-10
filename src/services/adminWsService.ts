import type { WsClient } from './wsClient';
import type {
	AdminKycListResponse,
	CuratedTopResponse,
	CuratedTopSetRequest,
} from './kycTypes';
import { normalizeAdminKycListResponse, normalizeCuratedTopResponse } from './kycMap';

const SVC = 'admin';

export function createAdminWs(client: WsClient) {
	return {
		listKyc(opts?: { status?: string, limit?: number, cursor?: string }): Promise<AdminKycListResponse> {
			const args: string[] = [];
			if (opts?.status?.trim()) args.push(opts.status.trim());
			if (opts?.limit != null) args.push(String(Math.min(100, Math.max(1, opts.limit))));
			if (opts?.cursor?.trim()) args.push(opts.cursor.trim());
			return client.request(SVC, 'listkyc', args)
				.then(json => normalizeAdminKycListResponse(json));
		},
		approveKyc(applicationId: string): Promise<{ ok: true }> {
			const id = String(applicationId ?? '').trim();
			if (!id) throw new Error('applicationId is required');
			return client.request(SVC, 'approvekyc', [id]) as Promise<{ ok: true }>;
		},
		rejectKyc(applicationId: string, reason: string): Promise<{ ok: true }> {
			const id = String(applicationId ?? '').trim();
			const r = String(reason ?? '').trim();
			if (!id) throw new Error('applicationId is required');
			if (!r) throw new Error('rejection reason is required');
			return client.request(SVC, 'rejectkyc', [id, ...r.split(/\s+/)]) as Promise<{ ok: true }>;
		},
		getCuratedTop(): Promise<CuratedTopResponse> {
			return client.request(SVC, 'getcuratedtop', [])
				.then(json => normalizeCuratedTopResponse(json));
		},
		setCuratedTop(body: CuratedTopSetRequest): Promise<CuratedTopResponse> {
			const slots = body.slots
				.slice()
				.sort((a, b) => a.rank - b.rank)
				.map(s => `${s.creatorUserId.trim()}@${s.rank}`)
				.filter(s => s.length > 2);
			return client.request(SVC, 'setcuratedtop', slots)
				.then(json => normalizeCuratedTopResponse(json));
		},
	};
}

export type AdminWs = ReturnType<typeof createAdminWs>;
