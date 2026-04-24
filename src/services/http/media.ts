import { postJson } from './client';

export type UploadKind = 'post_image' | 'post_video' | 'avatar' | 'banner' | 'kyc_doc';

export interface InitiateUploadRequest {
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	kind: UploadKind;
}

export interface InitiateUploadResponse {
	assetId: string;
	uploadUrl: string;
	fileUrl: string;
	headers?: Record<string, string>;
	expiresAt: string;
}

export interface CompleteUploadRequest {
	assetId: string;
	metadata?: Record<string, unknown>;
}

export interface CompleteUploadResponse<TAsset = unknown> {
	asset: TAsset;
}

export function initiateUpload(body: InitiateUploadRequest): Promise<InitiateUploadResponse> {
	return postJson<InitiateUploadResponse>('/media/uploads', body, { auth: true });
}

export function completeUpload(body: CompleteUploadRequest): Promise<CompleteUploadResponse> {
	return postJson<CompleteUploadResponse>('/media/complete', body, { auth: true });
}

export async function putUploadBytes(
	uploadUrl: string,
	bytes: Blob | ArrayBuffer,
	headers?: Record<string, string>
): Promise<void> {
	return globalThis.fetch(uploadUrl, {
		method: 'PUT',
		body: bytes as BodyInit,
		headers: headers ?? undefined,
	}).then(resp => {
		if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
	});
}
