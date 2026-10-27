import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Storage can be unavailable (private windows, blocked site data); fall back to memory.
function safeStorage() {
  try {
    const probe = "__mi_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    };
  }
}

/** Per-browser interview preferences: reading questions aloud and the preferred answer mode. */
export const useSettingsStore = create(
  persist(
    (set) => ({
      muted: false,
      voiceURI: null,
      rate: 1,
      answerMode: "text",
      setMuted: (muted) => set({ muted }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setRate: (rate) => set({ rate }),
      setAnswerMode: (answerMode) => set({ answerMode }),
    }),
    { name: "mi-settings", storage: createJSONStorage(safeStorage) },
  ),
);
