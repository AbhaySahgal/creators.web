/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_RAZORPAY_KEY_ID: string;
	readonly VITE_WS_URL?: string;
	readonly VITE_WS_TOKEN_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
