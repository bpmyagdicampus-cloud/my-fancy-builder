import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export type PwaState = {
  canInstall: boolean;
  isStandalone: boolean;
  persisted: boolean;
  storageUsedKb: number;
};

const INITIAL: PwaState = {
  canInstall: false,
  isStandalone: false,
  persisted: false,
  storageUsedKb: 0,
};

let state: PwaState = INITIAL;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

// Capture beforeinstallprompt immediately at module load time as well
if (typeof window !== "undefined") {
  if (window.__deferredPwaPrompt) {
    deferredPrompt = window.__deferredPwaPrompt;
    state = { ...state, canInstall: true };
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.__deferredPwaPrompt = deferredPrompt;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__deferredPwaPrompt = null;
    set({ canInstall: false, isStandalone: true });
  });
}

export const usePwa = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => INITIAL
  );

function computeLocalStorageKb(): number {
  if (typeof window === "undefined") return 0;
  try {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      const v = localStorage.getItem(k) ?? "";
      bytes += (k.length + v.length) * 2;
    }
    return Math.max(1, Math.round(bytes / 1024));
  } catch {
    return 0;
  }
}

export function refreshStorageEstimate() {
  set({ storageUsedKb: computeLocalStorageKb() });
}

export function initPwa() {
  if (typeof window === "undefined") return;

  if (window.__deferredPwaPrompt && !deferredPrompt) {
    deferredPrompt = window.__deferredPwaPrompt;
  }

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  set({
    canInstall: !!deferredPrompt && !isStandalone,
    isStandalone,
    storageUsedKb: computeLocalStorageKb(),
  });

  if (initialized) return;
  initialized = true;

  // Request persistent on-device storage so offline diary data is never evicted by the OS/browser
  if (navigator.storage && typeof navigator.storage.persist === "function") {
    void navigator.storage.persist().then((granted) => {
      set({ persisted: granted });
    });
  }

  // Register Service Worker for offline app launch & PWA install prompt
  if ("serviceWorker" in navigator) {
    const registerSw = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* ignore registration errors in dev */
      });
    };
    if (document.readyState === "complete") registerSw();
    else window.addEventListener("load", registerSw);
  }

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (ev) => {
    set({ isStandalone: ev.matches });
  });
}

/**
 * Directly triggers the browser's native 1-click app installation dialog (no custom text popup).
 */
export async function triggerInstallApp(): Promise<boolean> {
  initPwa();
  const promptEvent = deferredPrompt || (typeof window !== "undefined" ? window.__deferredPwaPrompt : null);
  if (!promptEvent) return false;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      if (typeof window !== "undefined") window.__deferredPwaPrompt = null;
      set({ canInstall: false });
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
