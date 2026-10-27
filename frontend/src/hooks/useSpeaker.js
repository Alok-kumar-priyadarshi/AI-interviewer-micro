import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore.js";

const isSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Reads text aloud with the browser's built-in speech synthesis (free, no server). */
export function useSpeaker() {
  const supported = isSupported();
  const muted = useSettingsStore((s) => s.muted);
  const voiceURI = useSettingsStore((s) => s.voiceURI);
  const rate = useSettingsStore((s) => s.rate);
  const [voices, setVoices] = useState(() =>
    supported ? window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")) : [],
  );
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices().filter((v) => v.lang.startsWith("en")));
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text, { force = false } = {}) => {
      if (!supported || !text || (muted && !force)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find((v) => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-US";
      utterance.rate = rate;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      synth.speak(utterance);
    },
    [supported, muted, voices, voiceURI, rate],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, voices, speaking, speak, stop };
}
