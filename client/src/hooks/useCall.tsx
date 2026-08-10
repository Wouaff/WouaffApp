import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { profiles } from '../services/api';
import {
  offCallAccepted,
  offCallAnswer,
  offCallEnded,
  offCallICE,
  offCallIncoming,
  offCallRejected,
  onCallAccepted,
  onCallAnswer,
  onCallEnded,
  onCallICE,
  onCallIncoming,
  onCallRejected,
} from '../services/socket';
import {
  getLocalStream,
  handleAnswer,
  handleICE,
  handleIncomingCall,
  handleOffer,
  handleRemoteEnd,
  subscribeCallbacks,
  unsubscribeCallbacks,
  acceptCall as voiceAcceptCall,
  endCall as voiceEndCall,
  rejectCall as voiceRejectCall,
  startCall as voiceStartCall,
  toggleCamera as voiceToggleCamera,
  toggleDeafen as voiceToggleDeafen,
  toggleMute as voiceToggleMute,
} from '../services/voice';
import type { CallerInfo, CallPayload, CallState } from '../types';
import { playRingtone, stopRingtone } from '../utils/ringtone';

interface CallContextValue {
  state: CallState;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  callerInfo: CallerInfo | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  startCall: (uid: string, pseudo: string, avatar?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextValue>({
  state: 'idle',
  remoteStream: null,
  localStream: null,
  callerInfo: null,
  muted: false,
  deafened: false,
  cameraOn: false,
  startCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleDeafen: () => {},
  toggleCamera: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CallState>('idle');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(getLocalStream());
  const callTargetRef = useRef<{ uid: string; pseudo: string; avatar?: string } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state !== 'ringing') stopRingtone();
  }, [state]);

  useEffect(() => {
    subscribeCallbacks({
      onStateChange: (s) => setState(s === 'ended' ? 'idle' : s),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onCallEnd: () => {
        setState('idle');
        setRemoteStream(null);
        setCallerInfo(null);
        setMuted(false);
        setDeafened(false);
        setCameraOn(false);
        callTargetRef.current = null;
      },
      onError: () => {
        setState('idle');
        setCallerInfo(null);
        callTargetRef.current = null;
      },
    });

    const onIncoming = async (data: CallPayload) => {
      /* Renégociation d'une piste vidéo en cours d'appel */
      if (stateRef.current === 'connected' && data.sdp) {
        handleOffer(data);
        return;
      }
      if (stateRef.current !== 'idle') return;
      try {
        const profile = await profiles.get(data.from);
        const info: CallerInfo = {
          uid: data.from,
          pseudo: ((profile as unknown as Record<string, string>)?.pseudo as string) || data.from,
          avatar: (profile as unknown as Record<string, string>)?.avatar as string | undefined,
        };
        setCallerInfo(info);
        callTargetRef.current = { uid: data.from, pseudo: info.pseudo, avatar: info.avatar };
        handleIncomingCall(data);
        playRingtone();
      } catch {
        setCallerInfo({ uid: data.from, pseudo: data.from });
        callTargetRef.current = { uid: data.from, pseudo: data.from };
        handleIncomingCall(data);
        playRingtone();
      }
    };

    const onAnswer = (data: CallPayload) => {
      handleAnswer(data);
    };

    const onICE = (data: CallPayload) => {
      handleICE(data);
    };

    const onEnded = () => {
      handleRemoteEnd();
    };

    const onAccepted = () => {
      /* caller notified that callee accepted */
    };

    const onRejected = () => {
      setState('idle');
      setCallerInfo(null);
      callTargetRef.current = null;
    };

    onCallIncoming(onIncoming);
    onCallAccepted(onAccepted);
    onCallAnswer(onAnswer);
    onCallICE(onICE);
    onCallEnded(onEnded);
    onCallRejected(onRejected);

    return () => {
      offCallIncoming(onIncoming);
      offCallAccepted(onAccepted);
      offCallAnswer(onAnswer);
      offCallICE(onICE);
      offCallEnded(onEnded);
      offCallRejected(onRejected);
      unsubscribeCallbacks();
    };
  }, []);

  const startCall = useCallback((uid: string, pseudo: string, avatar?: string) => {
    callTargetRef.current = { uid, pseudo, avatar };
    setCallerInfo({ uid, pseudo, avatar });
    voiceStartCall(uid);
  }, []);

  const acceptCall = useCallback(() => {
    voiceAcceptCall();
  }, []);

  const rejectCall = useCallback(() => {
    voiceRejectCall();
    setCallerInfo(null);
    callTargetRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    voiceEndCall();
  }, []);

  const toggleMute = useCallback(() => {
    const val = voiceToggleMute();
    setMuted(val);
  }, []);

  const toggleDeafen = useCallback(() => {
    const val = voiceToggleDeafen();
    setDeafened(val);
  }, []);

  const toggleCamera = useCallback(() => {
    voiceToggleCamera().then(setCameraOn);
  }, []);

  const value = useMemo(
    () => ({
      state,
      remoteStream,
      localStream: localStreamRef.current,
      callerInfo,
      muted,
      deafened,
      cameraOn,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleDeafen,
      toggleCamera,
    }),
    [
      state,
      remoteStream,
      callerInfo,
      muted,
      deafened,
      cameraOn,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleDeafen,
      toggleCamera,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  return useContext(CallContext);
}
