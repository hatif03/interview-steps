"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, AlertTriangle, Video, VideoOff } from "lucide-react";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING",
  SPEAKING = "SPEAKING",
  FINISHED = "FINISHED",
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface VoiceInterviewAgentProps {
  interviewId: string;
  userName: string;
  userId?: string;
  feedbackId?: string;
  canTake?: boolean;
  blockedMessage?: string;
}

function getSpeechRecognition(): typeof window.SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const RECOVERABLE_SPEECH_ERRORS = new Set(["network", "no-speech", "aborted"]);

function speechRetryDelay(retryCount: number) {
  return Math.min(500 * retryCount, 2000);
}

export function VoiceInterviewAgent({
  interviewId,
  userName,
  userId,
  feedbackId,
  canTake = true,
  blockedMessage,
}: VoiceInterviewAgentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finishedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition() && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [mediaReady]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const requestMediaAccess = useCallback(async () => {
    setRequestingMedia(true);
    setMediaError(null);
    try {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Release the mic so Web Speech API can use it without conflicting with getUserMedia.
      stream.getAudioTracks().forEach((track) => track.stop());
      mediaStreamRef.current = stream;
      setMediaReady(true);
    } catch (err) {
      const message =
        err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "Camera and microphone access was denied. Please allow access and try again."
            : err.message
          : "Could not access camera or microphone.";
      setMediaError(message);
      setMediaReady(false);
    } finally {
      setRequestingMedia(false);
    }
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith("en"));
      if (enVoice) utterance.voice = enVoice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      setStatus(CallStatus.SPEAKING);
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const listen = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SR = getSpeechRecognition();
      if (!SR) {
        reject(new Error("Speech recognition not supported"));
        return;
      }

      let settled = false;
      let networkRetries = 0;
      let restartTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (restartTimer) clearTimeout(restartTimer);
        recognitionRef.current = null;
      };

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const startRecognition = () => {
        if (finishedRef.current) {
          finish(() => reject(new Error("aborted")));
          return;
        }

        try {
          recognitionRef.current?.stop();
        } catch {
          // ignore stale recognition instances
        }

        const recognition = new SR();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        (recognition as SpeechRecognition & { continuous?: boolean }).continuous = false;
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
          const transcript = event.results[0]?.[0]?.transcript?.trim();
          if (transcript) {
            setListenError(null);
            finish(() => resolve(transcript));
          }
        };

        recognition.onerror = (event) => {
          if (settled || finishedRef.current) return;

          if (event.error === "network") {
            networkRetries += 1;
            setListenError("Reconnecting speech recognition...");
            return;
          }

          if (RECOVERABLE_SPEECH_ERRORS.has(event.error)) {
            return;
          }

          finish(() => reject(new Error(event.error)));
        };

        recognition.onend = () => {
          if (settled || finishedRef.current) {
            cleanup();
            return;
          }

          const delay =
            networkRetries > 0 ? speechRetryDelay(networkRetries) : 300;
          restartTimer = setTimeout(startRecognition, delay);
        };

        setStatus(CallStatus.LISTENING);
        try {
          recognition.start();
        } catch {
          restartTimer = setTimeout(startRecognition, 500);
        }
      };

      startRecognition();
    });
  }, []);

  const runInterviewLoop = useCallback(
    async (sid: string) => {
      setStatus(CallStatus.ACTIVE);
      while (!finishedRef.current) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          const userMessage = await listen();
          setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
          setStatus(CallStatus.PROCESSING);

          const turn = await api.mockInterviewTurn(sid, userMessage);
          setMessages((prev) => [...prev, { role: "assistant", content: turn.assistantMessage }]);
          await speak(turn.assistantMessage);

          if (turn.isComplete) {
            finishedRef.current = true;
            setStatus(CallStatus.FINISHED);
            const fb = await api.mockInterviewFeedback(sid, feedbackId);
            router.push(`/candidate/interview/${interviewId}/feedback?feedbackId=${fb.feedbackId}`);
            return;
          }
        } catch (err) {
          if (finishedRef.current) break;
          const message =
            err instanceof Error ? err.message : "Could not capture your answer. Trying again...";
          if (message !== "aborted") {
            setListenError(message);
          }
          setStatus(CallStatus.ACTIVE);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    },
    [listen, speak, interviewId, feedbackId, router]
  );

  const handleStart = async () => {
    if (!canTake) return;
    if (!speechSupported || !mediaReady) return;
    setStatus(CallStatus.CONNECTING);
    setListenError(null);
    finishedRef.current = false;

    try {
      const session = await api.startMockSession(interviewId, userId);
      setSessionId(session.sessionId);
      setMessages([{ role: "assistant", content: session.assistantMessage }]);
      await speak(session.assistantMessage);
      runInterviewLoop(session.sessionId);
    } catch (err) {
      console.error(err);
      setListenError(err instanceof Error ? err.message : "Could not start interview");
      setStatus(CallStatus.INACTIVE);
    }
  };

  const handleEnd = async () => {
    finishedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    window.speechSynthesis?.cancel();
    setStatus(CallStatus.FINISHED);

    if (sessionId) {
      try {
        const fb = await api.mockInterviewFeedback(sessionId, feedbackId);
        router.push(`/candidate/interview/${interviewId}/feedback?feedbackId=${fb.feedbackId}`);
      } catch {
        router.push(`/candidate/interview/${interviewId}/feedback`);
      }
    }
  };

  if (!speechSupported) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="font-medium text-amber-900">Voice not supported</p>
          <p className="text-sm text-amber-800">Use Chrome or Edge for voice interviews.</p>
        </div>
      </div>
    );
  }

  const isActive = [CallStatus.ACTIVE, CallStatus.LISTENING, CallStatus.PROCESSING, CallStatus.SPEAKING].includes(status);

  return (
    <div className="space-y-6">
      {!mediaReady && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex gap-3">
            <Video className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Camera & microphone required</p>
              <p className="text-sm text-muted-foreground">
                Allow access before starting. Speech recognition uses your browser&apos;s built-in engine at no cost.
              </p>
            </div>
          </div>
          {mediaError && (
            <p className="text-sm text-destructive">{mediaError}</p>
          )}
          <Button onClick={requestMediaAccess} disabled={requestingMedia}>
            {requestingMedia ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Requesting access...</>
            ) : (
              <><Video className="h-4 w-4 mr-2" />Enable camera & microphone</>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className={cn(
            "mx-auto mb-3 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center",
            status === CallStatus.SPEAKING && "ring-2 ring-primary animate-pulse"
          )}>
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold">AI Interviewer</h3>
          <p className="text-xs text-muted-foreground mt-1 capitalize">{status.toLowerCase().replace("_", " ")}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className={cn(
            "mx-auto mb-3 h-28 w-full max-w-[180px] rounded-lg overflow-hidden bg-muted flex items-center justify-center",
            status === CallStatus.LISTENING && "ring-2 ring-green-500 animate-pulse"
          )}>
            {mediaReady ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover transform-[scaleX(-1)]"
              />
            ) : (
              <VideoOff className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <h3 className="font-semibold">{userName}</h3>
          <p className="text-xs text-muted-foreground mt-1">Candidate</p>
        </div>
      </div>

      {listenError && isActive && (
        <p className="text-sm text-amber-700 text-center">{listenError}</p>
      )}

      {messages.length > 0 && (
        <div className="rounded-xl border bg-card p-4 max-h-48 overflow-y-auto space-y-2">
          {messages.map((m, i) => (
            <p key={i} className={cn("text-sm", m.role === "user" ? "text-foreground" : "text-muted-foreground")}>
              <span className="font-medium capitalize">{m.role}:</span> {m.content}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        {!canTake && blockedMessage && (
          <p className="text-sm text-amber-700 text-center max-w-md">{blockedMessage}</p>
        )}
        {!isActive && status !== CallStatus.FINISHED ? (
          <Button size="lg" onClick={handleStart} disabled={!canTake || !mediaReady || status === CallStatus.CONNECTING}>
            {status === CallStatus.CONNECTING ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
            ) : (
              <><Mic className="h-4 w-4 mr-2" />Start Interview</>
            )}
          </Button>
        ) : isActive ? (
          <Button size="lg" variant="destructive" onClick={handleEnd}>
            <MicOff className="h-4 w-4 mr-2" />End Interview
          </Button>
        ) : null}
      </div>
    </div>
  );
}
