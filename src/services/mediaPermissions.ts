export async function preflightMediaPermissions(opts: { audio: boolean, video: boolean }): Promise<void> {
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new Error('Media permissions are not supported in this browser.');
	}
	return navigator.mediaDevices.getUserMedia({ audio: opts.audio, video: opts.video }).then(stream => {
		for (const t of stream.getTracks()) t.stop();
	});
}
