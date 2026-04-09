import type { UploadKind } from './creatorsApi';
import { creatorsApi } from './creatorsApi';

export async function uploadMediaAsset(kind: UploadKind, file: File): Promise<{ assetId: string; fileUrl: string }> {
	const upload = await creatorsApi.media.createUpload({
		fileName: file.name,
		mimeType: file.type || 'application/octet-stream',
		sizeBytes: file.size,
		kind,
	});

	const headers = new Headers(upload.headers ?? {});
	if (file.type) headers.set('Content-Type', file.type);

	const putRes = await globalThis.fetch(upload.uploadUrl, {
		method: 'PUT',
		body: file,
		headers,
	});

	if (!putRes.ok) {
		throw new Error(`Upload failed (HTTP ${putRes.status})`);
	}

	await creatorsApi.media.complete({ assetId: upload.assetId });
	return { assetId: upload.assetId, fileUrl: upload.fileUrl };
}

