const FALLBACK_AGORA_APP_ID = '07cf36ba5a9d448ca14f57e616face7a';

const ENV_AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID?.trim() || '';
// In real environments we require an explicit App ID (and tokens minted by backend).
// The fallback App ID is only for local mock/dev scenarios.
export const AGORA_APP_ID = ENV_AGORA_APP_ID || (import.meta.env.MODE === 'mock' ? FALLBACK_AGORA_APP_ID : '');
export const AGORA_TOKEN_ENDPOINT = import.meta.env.VITE_AGORA_TOKEN_ENDPOINT?.trim() || '';

export const isAgoraConfigured = ENV_AGORA_APP_ID.length > 0;
