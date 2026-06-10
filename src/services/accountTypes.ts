/** B9: account deletion lifecycle */
export type DeleteAccountStatus = 'none' | 'pending_verification' | 'scheduled';

export interface DeleteRequestResponse {
	ok: true;
	expiresAt: string;
}

export interface DeleteVerifyRequest {
	code: string;
}

export interface DeleteVerifyResponse {
	ok: true;
	scheduledDeleteAt: string;
}

export interface DeleteStatusResponse {
	status: DeleteAccountStatus;
	scheduledDeleteAt?: string | null;
}

export interface ExportDataResponse {
	ok: true;
	jobId: string;
}

/** B11: stream guidelines */
export interface StreamGuidelinesResponse {
	key: string;
	version: string;
	body: string;
}

export interface AcceptStreamGuidelinesResponse {
	ok: true;
}
