import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const backendOrigin = env.VITE_CREATORS_API_URL || 'https://creatorsapi.pnine.me';

	return {
		plugins: [react()],
		optimizeDeps: {
			exclude: ['lucide-react'],
		},
		server: {
			proxy: {
				'/api': {
					target: backendOrigin,
					changeOrigin: true,
					secure: true,
				},
				'/ws-token': {
					target: backendOrigin,
					changeOrigin: true,
					secure: true,
				},
				'/auth': {
					target: backendOrigin,
					changeOrigin: true,
					secure: true,
				},
			},
		},
	};
});
