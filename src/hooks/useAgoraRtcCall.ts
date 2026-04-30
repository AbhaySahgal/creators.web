import { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, { type IAgoraRTCClient, type ILocalAudioTrack, type ILocalVideoTrack, type IRemoteAudioTrack, type IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

export type AgoraJoinParams = {
	enabled: boolean;
	appId: string;
	channelName: string;
	uid: number;
	token: string;
};

export type UseAgoraRtcCallParams = {
	join: AgoraJoinParams | null;
	isVideo: boolean;
	isMuted: boolean;
	isCameraOff: boolean;
	isSpeakerOn: boolean;
	localVideoEl: HTMLDivElement | null;
	remoteVideoEl: HTMLDivElement | null;
};

export function useAgoraRtcCall(params: UseAgoraRtcCallParams): {
	error: string;
	hasRemoteVideo: boolean;
} {
	const [error, setError] = useState('');
	const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

	const clientRef = useRef<IAgoraRTCClient | null>(null);
	const localAudioRef = useRef<ILocalAudioTrack | null>(null);
	const localVideoRef = useRef<ILocalVideoTrack | null>(null);
	const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null);
	const remoteVideoRef = useRef<IRemoteVideoTrack | null>(null);

	const joinedKeyRef = useRef<string | null>(null);
	const joinedOkRef = useRef(false);
	const joinInFlightRef = useRef<Promise<void> | null>(null);
	const devSkipLeaveOnceRef = useRef<boolean>(import.meta.env.DEV);

	const joinKey = useMemo(() => {
		const j = params.join;
		if (!j?.enabled) return null;
		return `${j.appId}|${j.channelName}|${j.uid}|${j.token}`;
	}, [params.join?.enabled, params.join?.appId, params.join?.channelName, params.join?.uid, params.join?.token]);

	// Join once per joinKey + publish microphone.
	useEffect(() => {
		const j = params.join;
		if (!j?.enabled) return;
		if (!joinKey) return;
		if (joinedKeyRef.current === joinKey || joinInFlightRef.current) return;

		joinedKeyRef.current = joinKey;
		joinedOkRef.current = false;
		setError('');

		const client = clientRef.current ?? AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' });
		clientRef.current = client;
		client.removeAllListeners();

		client.on('user-published', (user, mediaType) => {
			void client.subscribe(user, mediaType).then(() => {
				if (mediaType === 'audio' && user.audioTrack) {
					remoteAudioRef.current = user.audioTrack;
					if (params.isSpeakerOn) user.audioTrack.play();
				}
				if (mediaType === 'video' && user.videoTrack) {
					remoteVideoRef.current = user.videoTrack;
					setHasRemoteVideo(true);
					if (params.remoteVideoEl) {
						user.videoTrack.play(params.remoteVideoEl);
					}
				}
			}).catch(() => {
				setError('Failed to subscribe remote media.');
			});
		});

		client.on('user-unpublished', (_user, mediaType) => {
			if (mediaType === 'video') {
				setHasRemoteVideo(false);
				remoteVideoRef.current?.stop();
				remoteVideoRef.current = null;
			}
			if (mediaType === 'audio') {
				remoteAudioRef.current?.stop();
				remoteAudioRef.current = null;
			}
		});

		let cancelled = false;
		const doJoin = async () => {
			await client.join(j.appId, j.channelName, j.token, j.uid);
			if (cancelled) return;

			const audio = await AgoraRTC.createMicrophoneAudioTrack();
			localAudioRef.current = audio;
			await audio.setEnabled(!params.isMuted);
			await client.publish([audio]);

			joinedOkRef.current = true;
		};

		const p = doJoin()
			.catch((e: unknown) => {
				joinedKeyRef.current = null;
				joinedOkRef.current = false;
				const msg = e instanceof Error ? e.message : String(e);
				setError(msg || 'Failed to join media.');
			})
			.finally(() => {
				joinInFlightRef.current = null;
			});

		joinInFlightRef.current = p;

		return () => {
			cancelled = true;

			// StrictMode dev guard: skip the first cleanup to avoid aborting an in-flight join.
			if (devSkipLeaveOnceRef.current) {
				devSkipLeaveOnceRef.current = false;
				return;
			}

			remoteAudioRef.current?.stop();
			remoteAudioRef.current = null;
			remoteVideoRef.current?.stop();
			remoteVideoRef.current = null;
			setHasRemoteVideo(false);

			const la = localAudioRef.current;
			const lv = localVideoRef.current;
			localAudioRef.current = null;
			localVideoRef.current = null;

			const leavePromise =
				joinedOkRef.current && joinedKeyRef.current === joinKey ?
					client.leave().catch(() => undefined) :
					Promise.resolve(undefined);

			if (la) la.close();
			if (lv) lv.close();
			void leavePromise;
		};
	}, [joinKey]);

	// Publish/unpublish camera (no re-join).
	useEffect(() => {
		const client = clientRef.current;
		if (!client) return;
		if (!joinedOkRef.current) return;

		const wantVideo = params.isVideo && !params.isCameraOff;
		if (!wantVideo) {
			const lv = localVideoRef.current;
			if (lv) {
				localVideoRef.current = null;
				lv.stop();
				lv.close();
				void client.unpublish([lv]).catch(() => {});
			}
			return;
		}

		if (localVideoRef.current) {
			void localVideoRef.current.setEnabled(true);
			return;
		}

		let cancelled = false;
		void AgoraRTC.createCameraVideoTrack()
			.then(track => {
				if (cancelled) {
					track.close();
					return;
				}
				localVideoRef.current = track;
				if (params.localVideoEl) track.play(params.localVideoEl);
				return client.publish([track]);
			})
			.catch(() => {
				setError('Failed to start camera video.');
			});

		return () => {
			cancelled = true;
		};
	}, [params.isVideo, params.isCameraOff, params.localVideoEl]);

	// Mute/unmute mic without re-join.
	useEffect(() => {
		const la = localAudioRef.current;
		if (!la) return;
		void la.setEnabled(!params.isMuted);
	}, [params.isMuted]);

	// Speaker on/off (remote audio play/stop).
	useEffect(() => {
		const ra = remoteAudioRef.current;
		if (!ra) return;
		if (params.isSpeakerOn) ra.play();
		else ra.stop();
	}, [params.isSpeakerOn]);

	// When remote video element becomes available late, replay into it.
	useEffect(() => {
		const rv = remoteVideoRef.current;
		if (!rv) return;
		if (!params.remoteVideoEl) return;
		try {
			rv.play(params.remoteVideoEl);
		} catch {
			// ignore
		}
	}, [params.remoteVideoEl]);

	return { error, hasRemoteVideo };
}

