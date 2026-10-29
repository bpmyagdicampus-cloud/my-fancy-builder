import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaState = {
  canInstall: boolean;
  isStandalone: boolean;
  isIos: boolean;
  persisted: boolean;
  storageUsedKb: number;
  showHelpModal: boolean;
};

const INITIAL: PwaState = {
  canInstall: false,
  isStandalone: false,
  isIos: false,
  persisted: false,
  storageUsedKb: 0,
  showHelpModal: false,
};

let state: PwaState = INITIAL;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

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

export function closeInstallHelp() {
  set({ showHelpModal: false });
}

export function initPwa() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const ua = window.navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua) && !isStandalone;

  set({
    isStandalone,
    isIos,
    storageUsedKb: computeLocalStorageKb(),
  });

  // Request persistent on-device storage so offline diary data is never evicted by the OS/browser
  if (navigator.storage && typeof navigator.storage.persist === "function") {
    void navigator.storage.persist().then((granted) => {
      set({ persisted: granted });
    });
  }

  // Register Service Worker for offline app launch & PWA install prompt
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* ignore registration errors in dev */
      });
    });
    // Also register immediately if document is already loaded
    if (document.readyState === "complete") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* ignore */
      });
    }
  }

  // Capture Chrome/Edge/Android 1-click install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    set({ canInstall: false, isStandalone: true, showHelpModal: false });
  });

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (ev) => {
    set({ isStandalone: ev.matches });
  });
}

/**
 * Triggers 1-click native app installation if supported by the browser (Android Chrome / Desktop Chrome / Edge),
 * or opens a clear visual guide if the browser requires manual 'Add to Home Screen' / 'Install page as app'.
 */
export async function triggerInstallApp(): Promise<void> {
  initPwa();
  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPrompt = null;
        set({ canInstall: false });
      }
      return;
    } catch {
      /* fall through to help modal */
    }
  }
  set({ showHelpModal: true });
}
