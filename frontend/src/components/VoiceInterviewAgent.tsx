"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, AlertTriangle } from "lucide-react";

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
}

function getSpeechRecognition(): typeof window.SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function VoiceInterviewAgent({
  interviewId,
  userName,
  userId,
  feedbackId,
}: VoiceInterviewAgentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition() && "speechSynthesis" in window);
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
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };
      recognition.onerror = (event) => {
        reject(new Error(event.error));
      };
      recognition.onend = () => {
        recognitionRef.current = null;
      };

      setStatus(CallStatus.LISTENING);
      recognition.start();
    });
  }, []);

  const runInterviewLoop = useCallback(
    async (sid: string) => {
      setStatus(CallStatus.ACTIVE);
      while (!finishedRef.current) {
        try {
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
          console.error("Interview loop error:", err);
          if (finishedRef.current) break;
        }
      }
    },
    [listen, speak, interviewId, feedbackId, router]
  );

  const handleStart = async () => {
    if (!speechSupported) return;
    setStatus(CallStatus.CONNECTING);
    finishedRef.current = false;

    try {
      const session = await api.startMockSession(interviewId, userId);
      setSessionId(session.sessionId);
      setMessages([{ role: "assistant", content: session.assistantMessage }]);
      await speak(session.assistantMessage);
      runInterviewLoop(session.sessionId);
    } catch (err) {
      console.error(err);
      setStatus(CallStatus.INACTIVE);
    }
  };

  const handleEnd = async () => {
    finishedRef.current = true;
    recognitionRef.current?.stop();
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
            "mx-auto mb-3 h-16 w-16 rounded-full bg-muted flex items-center justify-center",
            status === CallStatus.LISTENING && "ring-2 ring-green-500 animate-pulse"
          )}>
            <span className="text-2xl font-bold text-muted-foreground">{userName.charAt(0)}</span>
          </div>
          <h3 className="font-semibold">{userName}</h3>
          <p className="text-xs text-muted-foreground mt-1">Candidate</p>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="rounded-xl border bg-card p-4 max-h-48 overflow-y-auto space-y-2">
          {messages.map((m, i) => (
            <p key={i} className={cn("text-sm", m.role === "user" ? "text-foreground" : "text-muted-foreground")}>
              <span className="font-medium capitalize">{m.role}:</span> {m.content}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-3">
        {!isActive && status !== CallStatus.FINISHED ? (
          <Button size="lg" onClick={handleStart} disabled={status === CallStatus.CONNECTING}>
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
