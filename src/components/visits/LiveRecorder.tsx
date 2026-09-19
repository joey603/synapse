"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SurfaceCard } from "@/components/ui/SurfaceCard";

type Phase = "idle" | "recording" | "paused" | "sending";

export function LiveRecorder({
  action,
  title,
  hint,
  startLabel,
  pauseLabel,
  resumeLabel,
  stopLabel,
  cancelLabel,
  deniedLabel,
  unsupportedLabel,
  sendingLabel,
  tooBigLabel,
  saveLabel,
}: {
  action: string;
  title: string;
  hint: string;
  startLabel: string;
  pauseLabel: string;
  resumeLabel: string;
  stopLabel: string;
  cancelLabel: string;
  deniedLabel: string;
  unsupportedLabel: string;
  sendingLabel: string;
  tooBigLabel: string;
  saveLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canPause, setCanPause] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mimeUsed = useRef("audio/webm");
  const startedAt = useRef(0);
  const pausedMs = useRef(0);
  const pauseBegan = useRef<number | null>(null);

  const currentElapsed = useCallback(() => {
    const extra = pauseBegan.current ? Date.now() - pauseBegan.current : 0;
    return Math.max(0, Date.now() - startedAt.current - pausedMs.current - extra);
  }, []);

  const release = useCallback(() => {
    const media = recorder.current;
    recorder.current = null;
    if (media && media.state !== "inactive") {
      media.ondataavailable = null;
      media.onstop = null;
      try {
        media.stop();
      } catch {
        // already stopped
      }
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(currentElapsed()), 250);
    return () => window.clearInterval(timer);
  }, [currentElapsed, phase]);

  useEffect(() => {
    return () => release();
  }, [release]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(unsupportedLabel);
      return;
    }
    try {
      const live = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = live;
      const mime = pickMime();
      mimeUsed.current = mime.split(";")[0] || "audio/webm";
      const media = mime ? new MediaRecorder(live, { mimeType: mime }) : new MediaRecorder(live);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      if (shouldUseTimeslice()) media.start(1000);
      else media.start();
      recorder.current = media;
      setCanPause(typeof media.pause === "function");
      startedAt.current = Date.now();
      pausedMs.current = 0;
      pauseBegan.current = null;
      setElapsed(0);
      setPhase("recording");
    } catch {
      release();
      setError(deniedLabel);
    }
  }

  function pause() {
    const media = recorder.current;
    if (!media || media.state !== "recording" || typeof media.pause !== "function") return;
    media.pause();
    pauseBegan.current = Date.now();
    setElapsed(currentElapsed());
    setPhase("paused");
  }

  function resume() {
    const media = recorder.current;
    if (!media || media.state !== "paused" || typeof media.resume !== "function") return;
    if (pauseBegan.current) pausedMs.current += Date.now() - pauseBegan.current;
    pauseBegan.current = null;
    media.resume();
    setPhase("recording");
  }

  function cancel() {
    chunks.current = [];
    release();
    setPhase("idle");
    setElapsed(0);
  }

  async function finish() {
    const media = recorder.current;
    if (!media || media.state === "inactive") return;
    setPhase("sending");
    const blob = await new Promise<Blob>((resolve) => {
      media.onstop = () =>
        resolve(new Blob(chunks.current, { type: media.mimeType || mimeUsed.current }));
      if (media.state === "recording" && shouldUseTimeslice()) {
        try {
          media.requestData();
        } catch {
          // stop() still flushes the last chunk
        }
      }
      media.stop();
    });
    release();
    if (blob.size === 0) {
      setError(unsupportedLabel);
      setPhase("idle");
      return;
    }
    if (blob.size > 25 * 1024 * 1024) {
      setError(tooBigLabel);
      setPhase("idle");
      return;
    }
    const type = (blob.type || mimeUsed.current || "audio/webm").split(";")[0] || "audio/webm";
    const ext = type.includes("mp4") || type.includes("aac") || type.includes("m4a") ? "m4a" : "webm";
    const file = new File([blob], `entretien.${ext}`, { type });
    const form = new FormData();
    form.set("file", file);
    form.set("consent", "on");
    try {
      const response = await fetch(action, { method: "POST", body: form });
      if (!response.ok && !response.redirected) {
        setError(saveLabel);
        setPhase("idle");
        return;
      }
      window.location.assign(response.url);
    } catch {
      setError(saveLabel);
      setPhase("idle");
    }
  }

  const live = phase === "recording" || phase === "paused";

  return (
    <SurfaceCard className="flex flex-col gap-4 p-4" id="record">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
      </div>
      <p className="flex items-center justify-center gap-2 text-center text-4xl font-semibold tabular-nums tracking-tight text-ink">
        {phase === "recording" ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
        ) : null}
        {formatDuration(elapsed)}
      </p>
      {error ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {phase === "idle" ? (
        <>
          <button
            type="button"
            onClick={() => void start()}
            className="min-h-12 rounded-2xl bg-accent text-sm font-semibold text-white"
          >
            {startLabel}
          </button>
        </>
      ) : null}
      {live ? (
        <div className="flex flex-col gap-2">
          {canPause ? (
            <button
              type="button"
              onClick={phase === "paused" ? resume : pause}
              className="min-h-12 rounded-2xl bg-surface text-sm font-semibold text-ink"
            >
              {phase === "paused" ? resumeLabel : pauseLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void finish()}
            className="min-h-12 rounded-2xl bg-accent text-sm font-semibold text-white"
          >
            {stopLabel}
          </button>
          <button type="button" onClick={cancel} className="min-h-12 rounded-2xl text-sm font-semibold text-muted">
            {cancelLabel}
          </button>
        </div>
      ) : null}
      {phase === "sending" ? <p className="text-center text-sm text-muted">{sendingLabel}</p> : null}
    </SurfaceCard>
  );
}

function pickMime() {
  const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function shouldUseTimeslice() {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(ua);
  return !(ios || safari);
}

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
