import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../context/WsContext';
import { apiErrorMessage, creatorsApi } from '../services/creatorsApi';
import { uploadMediaAsset } from '../services/mediaUpload';
import type { KycSubmitRequest } from '../services/kycTypes';
import { userWsKycSubmitWs } from '../services/userWsService';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type KycDocKey = 'idFront' | 'idBack' | 'selfie';

export interface KycSubmitInput {
	fullName: string;
	idFront: File;
	idBack: File;
	selfie: File;
	dob?: string;
	address?: string;
}

export function validateKycFile(file: File): string | null {
	const extOk = /\.(jpe?g|png|webp|pdf)$/i.exec(file.name);
	if (!ACCEPTED.includes(file.type) && !extOk) {
		return 'Use JPG, PNG, WEBP, or PDF';
	}
	if (file.size > MAX_BYTES) return 'File must be under 10 MB';
	return null;
}

export function useKycSubmit() {
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const { refreshMe, updateCreatorProfile } = useAuth();

	const [uploadingKey, setUploadingKey] = useState<KycDocKey | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploadedAssetIds, setUploadedAssetIds] = useState<Partial<Record<KycDocKey, string>>>({});

	const wsReady = wsConnected && wsAuthReady;

	const uploadDoc = useCallback((key: KycDocKey, file: File): Promise<string> => {
		const validation = validateKycFile(file);
		if (validation) return Promise.reject(new Error(validation));
		setUploadingKey(key);
		setError(null);
		return uploadMediaAsset('kyc_doc', file)
			.then(({ assetId }) => {
				setUploadedAssetIds(prev => ({ ...prev, [key]: assetId }));
				return assetId;
			})
			.catch(err => {
				const msg = apiErrorMessage(err, 'Upload failed');
				setError(msg);
				throw err;
			})
			.finally(() => {
				setUploadingKey(cur => (cur === key ? null : cur));
			});
	}, []);

	const submitApplication = useCallback((input: KycSubmitInput): Promise<void> => {
		const fullName = input.fullName.trim();
		if (!fullName) return Promise.reject(new Error('Legal name is required'));

		setSubmitting(true);
		setError(null);

		const uploadAll = (): Promise<KycSubmitRequest> =>
			Promise.all([
				uploadedAssetIds.idFront ?
					Promise.resolve(uploadedAssetIds.idFront) :
					uploadDoc('idFront', input.idFront),
				uploadedAssetIds.idBack ?
					Promise.resolve(uploadedAssetIds.idBack) :
					uploadDoc('idBack', input.idBack),
				uploadedAssetIds.selfie ?
					Promise.resolve(uploadedAssetIds.selfie) :
					uploadDoc('selfie', input.selfie),
			]).then(([docFrontAssetId, docBackAssetId, selfieAssetId]) => ({
				fullName,
				docFrontAssetId,
				docBackAssetId,
				selfieAssetId,
				dob: input.dob?.trim() || undefined,
				address: input.address?.trim() || undefined,
			}));

		const send = (body: KycSubmitRequest): Promise<void> => {
			const httpSubmit = () =>
				creatorsApi.me.kyc.submit(body).then(() => undefined);

			if (!wsReady) return httpSubmit();

			return ensureWsAuth()
				.then(() => userWsKycSubmitWs(ws, body).then(() => undefined))
				.catch(() => httpSubmit());
		};

		return uploadAll()
			.then(body => send(body))
			.then(() => refreshMe())
			.then(() => {
				updateCreatorProfile({ kycStatus: 'pending', isKYCVerified: false });
			})
			.catch(err => {
				const msg = apiErrorMessage(err, 'KYC submission failed');
				setError(msg);
				throw err;
			})
			.finally(() => {
				setSubmitting(false);
			});
	}, [
		ensureWsAuth,
		refreshMe,
		updateCreatorProfile,
		uploadDoc,
		uploadedAssetIds,
		ws,
		wsReady,
	]);

	const resetUploads = useCallback(() => {
		setUploadedAssetIds({});
		setError(null);
	}, []);

	return useMemo(() => ({
		uploadingKey,
		submitting,
		error,
		uploadedAssetIds,
		uploadDoc,
		submitApplication,
		resetUploads,
		clearError: () => { setError(null); },
	}), [uploadingKey, submitting, error, uploadedAssetIds, uploadDoc, submitApplication, resetUploads]);
}
