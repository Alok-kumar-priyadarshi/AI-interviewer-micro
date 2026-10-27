import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_SECONDS = 180;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** First container this browser can record (Safari: mp4, others: webm/opus). */
export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
}

export function isRecordingSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && pickMimeType() !== null;
}

function permissionMessage(err) {
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
    return "Microphone access was blocked. Allow it in your browser's site settings, or answer by typing.";
  }
  if (err?.name === "NotFoundError") return "No microphone was found. Connect one, or answer by typing.";
  return "The microphone could not be started. You can answer by typing instead.";
}

/**
 * Records one answer from the microphone.
 * status: idle → requesting → recording → stopped (blob ready) | error.
 * Stops automatically at `maxSeconds`. `level` (0..1) drives the input meter.
 */
export function useRecorder({ maxSeconds = MAX_RECORDING_SECONDS } = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(null); // { blob, durationSec }

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);
  const startedAtRef = useRef(0);

  const releaseDevices = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setRecording(null);
    setElapsed(0);
    setStatus("requesting");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setError(permissionMessage(err));
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationSec = (performance.now() - startedAtRef.current) / 1000;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      releaseDevices();
      setRecording({ blob, durationSec: Math.round(durationSec * 10) / 10 });
      setStatus("stopped");
    };
    recorderRef.current = recorder;

    // Input level meter from the live stream.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // The meter is optional; recording still works without it.
    }

    startedAtRef.current = performance.now();
    timerRef.current = setInterval(() => {
      const seconds = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 250);
    recorder.start(250);
    setStatus("recording");
  }, [maxSeconds, releaseDevices, stop]);

  const reset = useCallback(() => {
    setRecording(null);
    setElapsed(0);
    setError(null);
    setStatus("idle");
  }, []);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      releaseDevices();
    },
    [releaseDevices],
  );

  return { status, error, level, elapsed, recording, start, stop, reset, maxSeconds };
}
