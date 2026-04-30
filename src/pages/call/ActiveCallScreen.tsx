import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AgoraRTC, { type ILocalAudioTrack, type ILocalVideoTrack, type IRemoteAudioTrack, type IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Phone, RotateCcw, Minimize2, AlertTriangle, ArrowLeft } from '../../components/icons';
import { useCall } from '../../context/CallContext';
import { useSession } from '../../context/SessionContext';
import { useAuth } from '../../context/AuthContext';
import { useSessions } from '../../context/SessionsContext';
import { useNotifications } from '../../context/NotificationContext';
import { fetchAgoraRtcToken, getAgoraAppId, stringToAgoraUid } from '../../services/agoraRtc';
import { SessionFeedbackModal } from '../../components/session/SessionFeedbackModal';

function formatDuration(secs: number): string {
	const m = Math.floor(secs / 60).toString().padStart(2, '0');
	const s = (secs % 60).toString().padStart(2, '0');
	return `${m}:${s}`;
}

function getStatusText(opts: {
	isConnecting: boolean,
	callStatus?: string,
	connectionLabel?: string | null,
	networkLabel?: string | null,
}): string {
	// Connection/network labels override the base call status (WhatsApp-like).
	if (opts.networkLabel) return opts.networkLabel;
	if (opts.connectionLabel) return opts.connectionLabel;
	if (opts.isConnecting) {
		if (opts.callStatus === 'ringing') return 'Calling…';
		return 'Connecting…';
	}
	return 'Call';
}

export function ActiveCallScreen() {
	const navigate = useNavigate();
	const { state: callState, endCall, toggleMute, toggleCamera, toggleSpeaker } = useCall();
	const { state: sessionState, endSessionEarly } = useSession();
	const { state: sessionsState, endSession: endBookedSession } = useSessions();
	const { state: authState } = useAuth();
	const { showToast } = useNotifications();
	const call = callState.activeCall;
	const session = sessionState.activeSession;
	const sessionsBooking = sessionsState.active?.accepted?.kind === 'call' ? sessionsState.active : null;
	const [elapsed, setElapsed] = useState(0);
	const [bookedMuted, setBookedMuted] = useState(false);
	const [bookedCameraOff, setBookedCameraOff] = useState(false);
	const [bookedSpeakerOn, setBookedSpeakerOn] = useState(true);
	const [showControls, setShowControls] = useState(true);
	const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const localVideoRef = useRef<HTMLDivElement | null>(null);
	const remoteVideoRef = useRef<HTMLDivElement | null>(null);
	const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
	const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
	const remoteAudioTrackRef = useRef<IRemoteAudioTrack | null>(null);
	const remoteVideoTrackRef = useRef<IRemoteVideoTrack | null>(null);
	const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
	const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
	const [localMicPublished, setLocalMicPublished] = useState(false);
	const [agoraError, setAgoraError] = useState('');
	const [connectionLabel, setConnectionLabel] = useState<string | null>(null);
	const [networkLabel, setNetworkLabel] = useState<string | null>(null);
	const touchStartYRef = useRef<number | null>(null);
	const [showAudioRoute, setShowAudioRoute] = useState(false);
	const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
	const [audioOutputId, setAudioOutputId] = useState<string>('default');
	const fallbackUidRef = useRef<number | null>(null);
	const agoraClientRef = useRef<ReturnType<typeof AgoraRTC.createClient> | null>(null);
	const joinedKeyRef = useRef<string | null>(null);
	const joinInFlightRef = useRef<Promise<void> | null>(null);
	const joinedOkRef = useRef(false);
	const devSkipLeaveOnceRef = useRef<boolean>(import.meta.env.DEV);
	const [rtcJoinedKey, setRtcJoinedKey] = useState<string | null>(null);
	const lastBookedRoomIdRef = useRef<string | null>(null);
	const notifiedEndRequestIdRef = useRef<string | null>(null);
	const tokenRenewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isTimedSession = session && (session.type === 'audio' || session.type === 'video');
	const secondsRemaining = sessionState.secondsRemaining;
	const isWarning = isTimedSession && secondsRemaining <= 60 && secondsRemaining > 0;

	useEffect(() => {
		if (!call && !session && !sessionsBooking) {
			navigate(-1);
		}
	}, [call, session, sessionsBooking, navigate]);

	useEffect(() => {
		if (sessionsBooking?.accepted.room_id) {
			lastBookedRoomIdRef.current = sessionsBooking.accepted.room_id;
		}
	}, [sessionsBooking?.accepted.room_id]);

	useEffect(() => {
		const roomId = lastBookedRoomIdRef.current;
		if (!roomId) return;
		const ended = sessionsState.endedRooms[roomId] ?? (sessionsState.ended?.room_id === roomId ? sessionsState.ended : null);
		if (!ended) return;
		if (notifiedEndRequestIdRef.current === ended.request_id) return;
		notifiedEndRequestIdRef.current = ended.request_id;
		showToast(ended.reason === 'timeout' ? 'Call ended: time is over.' : 'Call ended.');
	}, [sessionsState.ended, sessionsState.endedRooms, showToast]);

	useEffect(() => {
		if (!isTimedSession && call?.status === 'active') {
			elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
		}
		return () => {
			if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
		};
	}, [call?.status, isTimedSession]);

	useEffect(() => {
		if (isTimedSession && !session) {
			endCall();
			navigate(-1);
		}
	}, [session, isTimedSession]);

	function resetControlsTimer() {
		setShowControls(true);
		if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
		controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
	}

	useEffect(() => {
		resetControlsTimer();
		return () => {
			if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
		};
	}, [call?.type, session?.type]);

	function handleEndCall() {
		if (sessionsBooking?.accepted) {
			void endBookedSession(sessionsBooking.accepted.request_id).catch(err => {
				setAgoraError(err instanceof Error ? err.message : 'Failed to end booked call session.');
			});
		}
		if (isTimedSession) {
			endSessionEarly();
		}
		endCall();
		navigate(-1);
	}

	const participantName =
		call?.participantName ??
		session?.creatorName ??
		sessionsBooking?.otherDisplay?.name ??
		'';
	const participantAvatar =
		call?.participantAvatar ??
		session?.creatorAvatar ??
		sessionsBooking?.otherDisplay?.avatar ??
		'';
	// Spec: sessions `kind:"call"` does not differentiate audio vs video.
	// We treat it as a call with optional camera.
	const callStatus = call?.status;
	const isVideo = true;
	const isConnecting = callStatus === 'ringing' || callStatus === 'connecting';
	// For sessions bookings, `CallContext` may be inactive. Use local toggle state as fallback.
	const isBookedCall = !!sessionsBooking?.accepted && sessionsBooking.accepted.kind === 'call';
	const isMuted = call ? (call.isMuted ?? false) : (isBookedCall ? bookedMuted : false);
	const isCameraOff = call ? (call.isCameraOff ?? false) : (isBookedCall ? bookedCameraOff : false);
	const isSpeakerOn = call ? (call.isSpeakerOn ?? true) : (isBookedCall ? bookedSpeakerOn : true);

	function handleToggleMute() {
		if (call) {
			toggleMute();
			return;
		}
		if (isBookedCall) setBookedMuted(v => !v);
	}

	function handleToggleCamera() {
		if (call) {
			toggleCamera();
			return;
		}
		if (isBookedCall) setBookedCameraOff(v => !v);
	}

	function handleToggleSpeaker() {
		if (call) {
			toggleSpeaker();
			return;
		}
		if (isBookedCall) setBookedSpeakerOn(v => !v);
	}

	const bookedTimer =
		sessionsBooking?.accepted.request_id && sessionsState.timer?.request_id === sessionsBooking.accepted.request_id ?
			sessionsState.timer :
			null;
	const bookedSecondsRemaining = bookedTimer?.kind === 'call' ? bookedTimer.remaining_sec : null;
	const isBookedWarning =
		typeof bookedSecondsRemaining === 'number' &&
		bookedSecondsRemaining <= 60 &&
		bookedSecondsRemaining > 0;

	const timerDisplay = isTimedSession ?
		formatDuration(secondsRemaining) :
		(bookedSecondsRemaining !== null ? formatDuration(Math.max(0, Math.floor(bookedSecondsRemaining))) : formatDuration(elapsed));
	const hideControls = !showControls && isVideo;

	const agoraJoinParams = useMemo(() => {
		// IMPORTANT: keep this derived object stable. Do not depend on whole `call` objects,
		// otherwise React re-renders can cancel join via effect cleanup.
		const me = authState.user;
		if (!me) return null;
		if (!call && !sessionsBooking) return null;

		const bookingAgora = sessionsBooking?.accepted.agora ?? null;
		const channelName = bookingAgora?.channel_name || (sessionsBooking?.accepted.room_id ?? '');
		const bookingIsBookedCall = !!sessionsBooking?.accepted;
		const bookingRequestId = sessionsBooking?.accepted.request_id ?? null;
		const appId = bookingAgora?.app_id ?? getAgoraAppId();
		const token = bookingAgora?.token ?? null;
		const dummy = !!bookingAgora?.dummy;
		const uid =
			bookingAgora?.uid ??
			(() => {
				if (fallbackUidRef.current == null) {
					fallbackUidRef.current = Math.floor(Math.random() * 2_000_000_000) + 1;
				}
				return fallbackUidRef.current;
			})() ??
			stringToAgoraUid(me.id);

		const joinKey = `${appId}|${channelName}|${uid}|${token ?? ''}`;

		return {
			isBookedCall: bookingIsBookedCall,
			bookingRequestId,
			channelName,
			uid,
			appId,
			token,
			dummy,
			joinKey,
		};
	}, [
		authState.user?.id,
		call?.id,
		call?.type,
		sessionsBooking?.accepted.request_id,
		sessionsBooking?.accepted.room_id,
		sessionsBooking?.accepted.agora?.app_id,
		sessionsBooking?.accepted.agora?.channel_name,
		sessionsBooking?.accepted.agora?.uid,
		sessionsBooking?.accepted.agora?.token,
		sessionsBooking?.accepted.agora?.dummy,
	]);

	useEffect(() => {
		const p = agoraJoinParams;
		if (!p) return;
		const { isBookedCall: bookingIsBookedCall, bookingRequestId, channelName, uid, appId, token, dummy, joinKey } = p;

		if (import.meta.env.DEV) {
			(globalThis as unknown as { CW_AGORA_LAST_JOIN?: unknown }).CW_AGORA_LAST_JOIN = {
				at: new Date().toISOString(),
				isBookedCall: bookingIsBookedCall,
				request_id: bookingRequestId,
				channel_name: channelName,
				uid,
				has_token: !!token,
				dummy,
			};
		}

		if (!appId) {
			setAgoraError('Agora is not configured (missing VITE_AGORA_APP_ID).');
			return () => {};
		}

		if (dummy) {
			setAgoraError('Call is in dummy mode (Agora not configured).');
			return () => {};
		}

		// Join exactly once per key. Avoid re-joining on unrelated UI state changes.
		if (joinedKeyRef.current === joinKey || joinInFlightRef.current) {
			return () => {};
		}
		joinedKeyRef.current = joinKey;
		joinedOkRef.current = false;
		setAgoraError('');

		const client = agoraClientRef.current ?? AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' });
		agoraClientRef.current = client;

		client.removeAllListeners();
		setConnectionLabel(null);
		setNetworkLabel(null);
		client.on('user-published', (user, mediaType) => {
			console.info('Agora user-published', { uid: user.uid, mediaType });
			void client.subscribe(user, mediaType).then(() => {
				if (mediaType === 'audio' && user.audioTrack) {
					remoteAudioTrackRef.current = user.audioTrack;
					setHasRemoteAudio(true);
					// Don't call play() here: browsers can block autoplay. Playback is handled by effect.
					try {
						user.audioTrack.setVolume(100);
					} catch {
						// ignore
					}
				}
				if (mediaType === 'video' && user.videoTrack) {
					remoteVideoTrackRef.current = user.videoTrack;
					setHasRemoteVideo(true);
					if (remoteVideoRef.current) {
						user.videoTrack.play(remoteVideoRef.current);
					}
				}
			}).catch(() => {
				setAgoraError('Failed to subscribe remote media.');
			});
		});

		client.on('user-unpublished', (_user, mediaType) => {
			console.info('Agora user-unpublished', { mediaType });
			if (mediaType === 'video') {
				setHasRemoteVideo(false);
				remoteVideoTrackRef.current = null;
			}
			if (mediaType === 'audio') {
				setHasRemoteAudio(false);
				remoteAudioTrackRef.current?.stop();
				remoteAudioTrackRef.current = null;
			}
		});

		// WhatsApp-like connection / network indicators (best-effort; SDK emits vary).
		client.on('connection-state-change', (curState: unknown, _prev: unknown, _reason: unknown) => {
			const v = (typeof curState === 'string' ? curState : '').toUpperCase();
			if (v.includes('RECONNECT')) setConnectionLabel('Reconnecting…');
			else if (v.includes('DISCONNECT')) setConnectionLabel('Reconnecting…');
			else if (v.includes('CONNECTING')) setConnectionLabel('Connecting…');
			else if (v.includes('CONNECTED')) setConnectionLabel(null);
		});
		client.on('network-quality', (stats: unknown) => {
			const s = (stats && typeof stats === 'object') ? (stats as Record<string, unknown>) : {};
			const up = typeof s.uplinkNetworkQuality === 'number' ? s.uplinkNetworkQuality : null;
			const down = typeof s.downlinkNetworkQuality === 'number' ? s.downlinkNetworkQuality : null;
			const q = Math.max(Number(up ?? 0), Number(down ?? 0));
			if (Number.isFinite(q) && q >= 4) setNetworkLabel('Poor network');
			else setNetworkLabel(null);
		});

		let cancelled = false;

		const doJoin = () => {
			if (bookingIsBookedCall && !channelName) {
				return Promise.reject(new Error('Missing room_id for booked call. Backend must include `room_id` in `sessions|accepted`.'));
			}
			const acceptedToken = token;
			const resolvedTokenPromise =
				bookingIsBookedCall ?
					Promise.resolve(acceptedToken) :
					(acceptedToken ? Promise.resolve(acceptedToken) : fetchAgoraRtcToken(channelName, uid, 'host'));

			return resolvedTokenPromise.then(resolvedToken => {
				if (!resolvedToken) {
					throw new Error(
						bookingIsBookedCall ?
							'Missing Agora token in booking. Backend must include `sessions|accepted.agora.token` for each user.' :
							'Missing Agora token. Start the call via sessions booking so the server sends `sessions|accepted.agora.token` (or set VITE_AGORA_TOKEN_ENDPOINT to a real HTTP token endpoint).'
					);
				}
				return client.join(appId, channelName, resolvedToken, uid);
			}).then(() => {
				if (cancelled) return;
				// Permissions must be requested on a user gesture (Request/Accept click),
				// not during async join (browsers can block or behave inconsistently).
				return undefined;
			}).then(() => {
				if (cancelled) return;
				return AgoraRTC.createMicrophoneAudioTrack().then(audioTrack => {
					localAudioTrackRef.current = audioTrack;
					return audioTrack.setEnabled(!isMuted).then(() => audioTrack);
				});
			}).then(audioTrack => {
				if (cancelled) return;
				if (!audioTrack) return;
				return client.publish([audioTrack])
					.then(() => {
						setLocalMicPublished(true);
					})
					.catch((e: unknown) => {
						const msg = e instanceof Error ? e.message : String(e);
						throw new Error(
							`Failed to publish microphone track. ` +
							`This usually means the Agora RTC token was minted with subscriber-only privileges (cannot publish). ` +
							`Ask backend to mint tokens with publish privileges for both users. ` +
							(msg ? `(${msg})` : '')
						);
					});
			}).then(() => {
				if (cancelled) return;
				joinedOkRef.current = true;
				setRtcJoinedKey(joinKey);
			});
		};

		const pJoin = doJoin()
			.catch(err => {
				const msg = err instanceof Error ? err.message : '';
				// If join failed/cancelled, allow retry on next render.
				joinedKeyRef.current = null;
				joinedOkRef.current = false;
				// Common Agora join failure when two clients join same channel with same uid.
				if (msg.toLowerCase().includes('uid_conflict') || msg.toLowerCase().includes('uid conflict')) {
					setAgoraError(
						`Agora UID conflict (channel=${channelName}, uid=${uid}${bookingRequestId ? `, request=${bookingRequestId}` : ''}). ` +
						'This usually means the backend issued the same `agora.uid` to both users for the same booking, ' +
						'or the same account joined the same channel twice (e.g. two tabs).'
					);
					return;
				}
				if (msg) setAgoraError(msg);
				else setAgoraError('Unable to connect media. Accept may have failed to mint Agora credentials on server.');
			})
			.finally(() => {
				joinInFlightRef.current = null;
			});
		joinInFlightRef.current = pJoin;

		return () => {
			cancelled = true;
			setConnectionLabel(null);
			setNetworkLabel(null);

			// React 18 StrictMode (dev) mounts + immediately unmounts effects once to detect unsafe side effects.
			// If we leave during that dev-only cleanup, Agora cancels the in-flight join ("cancel token canceled").
			// Skip the first cleanup in dev to keep join stable.
			if (devSkipLeaveOnceRef.current) {
				devSkipLeaveOnceRef.current = false;
				return;
			}
			setRtcJoinedKey(prev => (prev === joinKey ? null : prev));
			setLocalMicPublished(false);
			setHasRemoteAudio(false);

			remoteAudioTrackRef.current?.stop();
			remoteAudioTrackRef.current = null;
			remoteVideoTrackRef.current?.stop();
			remoteVideoTrackRef.current = null;
			setHasRemoteVideo(false);

			const localAudioTrack = localAudioTrackRef.current;
			const localVideoTrack = localVideoTrackRef.current;
			localAudioTrackRef.current = null;
			localVideoTrackRef.current = null;

			// If we never successfully joined, don't try to leave (it can abort an in-flight join).
			// Also reset joinedKey so we can retry.
			if (!joinedOkRef.current && joinedKeyRef.current === joinKey) {
				joinedKeyRef.current = null;
			}

			const leavePromise =
				joinedOkRef.current && joinedKeyRef.current === joinKey ?
					client.leave().catch(() => undefined) :
					Promise.resolve(undefined);
			if (localAudioTrack) localAudioTrack.close();
			if (localVideoTrack) localVideoTrack.close();
			void leavePromise;
		};
	}, [agoraJoinParams?.joinKey]);

	// Refresh Agora RTC token before expiry when a token endpoint is configured.
	useEffect(() => {
		if (tokenRenewTimerRef.current) {
			clearTimeout(tokenRenewTimerRef.current);
			tokenRenewTimerRef.current = null;
		}
		const client = agoraClientRef.current as (ReturnType<typeof AgoraRTC.createClient> & { renewToken?: (t: string) => Promise<void> }) | null;
		if (!client) return;
		if (!joinedOkRef.current) return;
		if (!rtcJoinedKey) return;

		const bookingAgora = sessionsBooking?.accepted?.agora ?? null;
		if (!bookingAgora) return;
		if (bookingAgora.dummy) return;
		if (!bookingAgora.expires_at) return;

		const expiresAtMs = new Date(bookingAgora.expires_at).getTime();
		if (!Number.isFinite(expiresAtMs)) return;

		// Only renew when we have a minting endpoint configured in this build.
		// `fetchAgoraRtcToken` returns null when `VITE_AGORA_TOKEN_ENDPOINT` is not set.
		const channel = bookingAgora.channel_name || sessionsBooking?.accepted?.room_id || '';
		const uid = bookingAgora.uid;
		if (!channel || !uid) return;

		const renewAtMs = expiresAtMs - 5 * 60_000; // 5 minutes before expiry
		const delayMs = Math.max(10_000, renewAtMs - Date.now()); // never schedule too aggressively

		tokenRenewTimerRef.current = setTimeout(() => {
			void fetchAgoraRtcToken(channel, uid, 'host')
				.then(newToken => {
					if (!newToken) return;
					if (typeof client.renewToken === 'function') {
						return client.renewToken(newToken);
					}
					// Some SDK builds use `renewToken` but typings can differ; ignore if unavailable.
					return undefined;
				})
				.catch(() => {});
		}, delayMs);

		return () => {
			if (tokenRenewTimerRef.current) {
				clearTimeout(tokenRenewTimerRef.current);
				tokenRenewTimerRef.current = null;
			}
		};
	}, [rtcJoinedKey, sessionsBooking?.accepted?.agora?.expires_at, sessionsBooking?.accepted?.agora?.uid, sessionsBooking?.accepted?.agora?.channel_name, sessionsBooking?.accepted?.room_id]);

	// Video publish/unpublish should not trigger a re-join.
	useEffect(() => {
		const client = agoraClientRef.current;
		if (!client) return;
		if (!joinedOkRef.current) return;
		if (!rtcJoinedKey) return;

		// If this is an audio call, ensure no camera track is active.
		const wantVideo = isVideo && !isCameraOff;
		if (!wantVideo) {
			const vt = localVideoTrackRef.current;
			if (vt) {
				localVideoTrackRef.current = null;
				vt.stop();
				vt.close();
				void client.unpublish([vt]).catch(() => {});
			}
			return;
		}

		// Want video: create & publish if missing.
		if (localVideoTrackRef.current) {
			void localVideoTrackRef.current.setEnabled(true);
			return;
		}

		let cancelled = false;
		void AgoraRTC.createCameraVideoTrack()
			.then(videoTrack => {
				// #region agent log
				fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V1',location:'ActiveCallScreen.tsx:camera:create',message:'Created camera track',data:{hasTrack:!!videoTrack},timestamp:Date.now()})}).catch(()=>{});
				// #endregion
				try {
					(videoTrack as unknown as { on?: (ev: string, fn: () => void) => void }).on?.('track-ended', () => {
						// #region agent log
						fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V2',location:'ActiveCallScreen.tsx:camera:track-ended',message:'Camera track ended',data:{},timestamp:Date.now()})}).catch(()=>{});
						// #endregion
					});
				} catch {
					// ignore
				}
				if (cancelled) {
					videoTrack.close();
					return;
				}
				localVideoTrackRef.current = videoTrack;
				if (localVideoRef.current) videoTrack.play(localVideoRef.current);
				// #region agent log
				fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V3',location:'ActiveCallScreen.tsx:camera:publish:begin',message:'Publishing camera track',data:{},timestamp:Date.now()})}).catch(()=>{});
				// #endregion
				return client.publish([videoTrack]).then(() => {
					// #region agent log
					fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V3',location:'ActiveCallScreen.tsx:camera:publish:ok',message:'Published camera track OK',data:{},timestamp:Date.now()})}).catch(()=>{});
					// #endregion
				}).catch((e: unknown) => {
					const msg = e instanceof Error ? e.message : String(e);
					// #region agent log
					fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V4',location:'ActiveCallScreen.tsx:camera:publish:fail',message:'Publish camera failed',data:{err:String(msg??'').slice(0,180)},timestamp:Date.now()})}).catch(()=>{});
					// #endregion
					setAgoraError(
						`Failed to publish camera track. ` +
						`This usually means the Agora RTC token was minted without publish privileges. ` +
						(msg ? `(${msg})` : '')
					);
				});
			})
			.catch(() => {
				// #region agent log
				fetch('http://127.0.0.1:7376/ingest/dacc4137-b3f3-4a4a-97cf-28b8bb043d99',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f82690'},body:JSON.stringify({sessionId:'f82690',runId:'cam-bug',hypothesisId:'V5',location:'ActiveCallScreen.tsx:camera:create:fail',message:'createCameraVideoTrack failed',data:{},timestamp:Date.now()})}).catch(()=>{});
				// #endregion
				setAgoraError('Failed to start camera video.');
			});

		return () => {
			cancelled = true;
		};
	}, [rtcJoinedKey, isVideo, isCameraOff]);

	useEffect(() => {
		const localAudioTrack = localAudioTrackRef.current;
		if (!localAudioTrack) return;
		void localAudioTrack.setEnabled(!isMuted);
	}, [rtcJoinedKey, isMuted]);

	useEffect(() => {
		const localVideoTrack = localVideoTrackRef.current;
		if (!localVideoTrack) return;
		void localVideoTrack.setEnabled(!isCameraOff);
	}, [isCameraOff]);

	useEffect(() => {
		const remoteAudioTrack = remoteAudioTrackRef.current;
		if (!remoteAudioTrack) return;
		if (!isSpeakerOn) {
			remoteAudioTrack.stop();
			return;
		}
		try {
			remoteAudioTrack.play();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			// Autoplay policies can block audio; user gesture (tap/click) usually resolves it.
			setAgoraError(prev => prev || (msg ? `Audio blocked by browser autoplay policy. Tap/click once on the call screen. (${msg})` : 'Audio blocked by browser autoplay policy. Tap/click once on the call screen.'));
		}
	}, [isSpeakerOn, hasRemoteAudio, rtcJoinedKey]);

	useEffect(() => {
		if (!showAudioRoute) return;
		if (!navigator.mediaDevices?.enumerateDevices) return;
		void navigator.mediaDevices.enumerateDevices()
			.then(list => {
				const outs = list.filter(d => d.kind === 'audiooutput');
				setAudioOutputs(outs);
			})
			.catch(() => {
				setAudioOutputs([]);
			});
	}, [showAudioRoute]);

	return (
		<div
			className="fixed inset-0 z-[300] bg-overlay flex flex-col"
			onTouchStart={e => {
				touchStartYRef.current = e.touches?.[0]?.clientY ?? null;
				resetControlsTimer();
			}}
			onTouchEnd={e => {
				const startY = touchStartYRef.current;
				const endY = e.changedTouches?.[0]?.clientY ?? null;
				if (startY != null && endY != null) {
					const dy = endY - startY;
					if (dy > 30) setShowControls(true);
					if (dy < -30 && isVideo) setShowControls(false);
				}
				touchStartYRef.current = null;
			}}
			onClick={e => {
				// Tap background toggles controls (WhatsApp-like). Clicking UI keeps them visible.
				if (e.target === e.currentTarget) {
					setShowControls(v => !v);
					return;
				}
				resetControlsTimer();
			}}
		>
			{/* WhatsApp-like top bar */}
			<div className={`absolute top-0 left-0 right-0 z-30 px-4 pt-4 pb-3 ${hideControls ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => { void navigate(-1); }}
						className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur"
						aria-label="Back"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<img
						src={participantAvatar}
						alt={participantName}
						className="w-10 h-10 rounded-full object-cover border border-white/10"
					/>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-white truncate">{participantName}</p>
						<p className="text-[11px] text-white/70 truncate">
							{getStatusText({ isConnecting, callStatus, connectionLabel, networkLabel })}
							{!isConnecting ? ` · ${timerDisplay}` : ''}
						</p>
					</div>
					<button
						type="button"
						onClick={() => { void navigate(-1); }}
						className="ml-auto w-10 h-10 rounded-full bg-black/30 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur"
						aria-label="Minimize"
					>
						<Minimize2 className="w-5 h-5" />
					</button>
				</div>
			</div>

			{isVideo ? (
				<>
					{/* Always mount the remote video container so Agora can `play()` into it. */}
					<div ref={remoteVideoRef} className="absolute inset-0" />
					{/* While remote video isn't available, show a blurred avatar fallback overlay. */}
					{!hasRemoteVideo ? (
						<div className="absolute inset-0">
							<img
								src={participantAvatar}
								alt={participantName}
								className="w-full h-full object-cover scale-105"
							/>
							<div className="absolute inset-0 bg-background/30 dark:bg-black/30" />
						</div>
					) : null}
				</>
			) : (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="absolute inset-0 bg-gradient-to-b from-surface2 to-overlay" />
					<div className="relative flex flex-col items-center gap-5">
						<div className="relative">
							<div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping scale-150" />
							<img
								src={participantAvatar}
								alt={participantName}
								className="relative w-28 h-28 rounded-full object-cover border-4 border-border/20"
							/>
						</div>
					</div>
				</div>
			)}

			<div className="relative z-10 flex flex-col h-full pt-16">

				{(isWarning || isBookedWarning) && (
					<div className={`mx-6 bg-rose-500/20 border border-rose-500/30 rounded-2xl px-4 py-3 flex items-center gap-2 transition-opacity duration-300 ${hideControls ? 'opacity-0' : 'opacity-100'}`}>
						<AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
						<p className="text-sm text-rose-300 font-medium">1 minute remaining in your session</p>
					</div>
				)}

				{isVideo && !isCameraOff && (
					<div className="absolute top-16 right-4 z-20">
						<div className="w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-border/20 shadow-xl bg-surface2">
							<div ref={localVideoRef} className="w-full h-full bg-gradient-to-br from-rose-900/40 to-surface2" />
						</div>
					</div>
				)}

				{agoraError && (
					<div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-rose-500/20 border border-rose-500/30 rounded-xl px-3 py-1.5">
						<p className="text-xs text-rose-300">{agoraError}</p>
					</div>
				)}
				{import.meta.env.DEV ? (
					<div className={`absolute top-28 left-1/2 -translate-x-1/2 z-30 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 ${hideControls ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
						<p className="text-[11px] text-white/70">
							mic:{localMicPublished ? 'on' : 'off'} · remoteAudio:{hasRemoteAudio ? 'yes' : 'no'} · remoteVideo:{hasRemoteVideo ? 'yes' : 'no'}
						</p>
					</div>
				) : null}

				<div className={`mt-auto pb-14 px-8 transition-opacity duration-300 ${hideControls ? 'opacity-0' : 'opacity-100'}`}>
					<div className="flex items-center justify-center gap-5 mb-8">
						<ControlBtn active={!isMuted} onPress={handleToggleMute} icon={isMuted ? MicOff : Mic} label={isMuted ? 'Unmute' : 'Mute'} />
						{isVideo && (
							<ControlBtn active={!isCameraOff} onPress={handleToggleCamera} icon={isCameraOff ? VideoOff : Video} label={isCameraOff ? 'Camera off' : 'Camera'} />
						)}
						<ControlBtn active={isSpeakerOn} onPress={handleToggleSpeaker} icon={isSpeakerOn ? Volume2 : VolumeX} label="Speaker" />
						{isVideo && (
							<ControlBtn active={false} onPress={() => {}} icon={RotateCcw} label="Flip" />
						)}
					</div>

					{hasRemoteAudio ? (
						<div className="flex justify-center mb-6">
							<button
								type="button"
								onClick={() => setShowAudioRoute(true)}
								className="text-[11px] px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/40 text-white/80 backdrop-blur border border-white/10"
							>
								Output: {audioOutputs.find(d => d.deviceId === audioOutputId)?.label || (audioOutputId === 'default' ? 'Default' : 'Device')}
							</button>
						</div>
					) : null}

					<div className="flex justify-center">
						<button
							onClick={handleEndCall}
							className="w-16 h-16 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center shadow-xl shadow-rose-500/40 transition-all active:scale-90"
							aria-label="End call"
						>
							<Phone className="w-7 h-7 text-white rotate-[135deg]" />
						</button>
					</div>
				</div>
			</div>
			<SessionFeedbackModal />

			{showAudioRoute ? (
				<div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center p-0 sm:p-4">
					<div className="absolute inset-0 bg-overlay/70 backdrop-blur-sm" onClick={() => setShowAudioRoute(false)} />
					<div className="relative w-full sm:max-w-md bg-surface border border-border/20 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
						<div className="p-4 border-b border-border/10 flex items-center gap-3">
							<p className="text-sm font-bold text-foreground">Audio output</p>
							<button
								type="button"
								onClick={() => setShowAudioRoute(false)}
								className="ml-auto text-xs px-3 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted"
							>
								Close
							</button>
						</div>
						<div className="p-4 space-y-2 max-h-[50vh] overflow-auto">
							{typeof navigator.mediaDevices?.enumerateDevices === 'function' ? null : (
								<p className="text-xs text-muted">Audio device selection is not supported in this browser.</p>
							)}
							{audioOutputs.length ? (
								audioOutputs.map(d => (
									<button
										key={d.deviceId}
										type="button"
										onClick={() => {
											setAudioOutputId(d.deviceId);
											const t = remoteAudioTrackRef.current as unknown as { setPlaybackDevice?: (id: string) => Promise<void> };
											if (t?.setPlaybackDevice) {
												void t.setPlaybackDevice(d.deviceId)
													.then(() => showToast('Audio output updated'))
													.catch(() => showToast('Failed to switch audio output', 'error'));
											} else {
												showToast('This browser/SDK cannot switch audio output.', 'error');
											}
											setShowAudioRoute(false);
										}}
										className={`w-full text-left px-3 py-2 rounded-2xl border transition-colors ${
											audioOutputId === d.deviceId ?
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
												'border-border/20 bg-foreground/5 hover:bg-foreground/10 text-foreground'
										}`}
									>
										<p className="text-sm font-semibold truncate">{d.label || 'Audio output'}</p>
										<p className="text-[11px] text-muted truncate">{d.deviceId}</p>
									</button>
								))
							) : (
								<p className="text-xs text-muted">No output devices found.</p>
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

function ControlBtn({
	active,
	onPress,
	icon: Icon,
	label,
}: {
	active: boolean,
	onPress: () => void,
	icon: React.ElementType,
	label: string,
}) {
	return (
		<div className="flex flex-col items-center gap-2">
			<button
				onClick={onPress}
				aria-label={label}
				className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 backdrop-blur ${
					active ?
						'bg-black/30 hover:bg-black/40 text-white' :
						'bg-black/20 hover:bg-black/30 text-white/70 opacity-90'
				}`}
			>
				<Icon className="w-6 h-6 text-white" />
			</button>
			<span className="text-[10px] text-white/70">{label}</span>
		</div>
	);
}
