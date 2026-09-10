import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function getStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    nav.standalone === true
  );
}

/**
 * تثبيت PWA — beforeinstallprompt (Chrome/Edge/Android) + كشف الوضع المستقل (iOS/غيره).
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(getStandalone);

  useEffect(() => {
    setStandalone(getStandalone());
  }, []);

  useEffect(() => {
    const onBip = (e: Event) => {
      // Prevent default to stop browser's automatic install prompt
      e.preventDefault();
      // Store the event for later use when user clicks install button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback((): "accepted" | "dismissed" | "unavailable" => {
    if (!deferred) return "unavailable";
    
    // Call prompt() synchronously - this must be called directly from user gesture
    try {
      deferred.prompt();
      
      // Handle userChoice synchronously with then() to avoid async/await
      deferred.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          setStandalone(true);
        }
        setDeferred(null);
      }).catch(() => {
        // Ignore errors from userChoice
        setDeferred(null);
      });
      
      return "accepted"; // Return immediately, actual result handled in then()
    } catch (error) {
      // Ignore errors from prompt() - this can happen if called without user gesture
      console.warn("PWA install prompt failed:", error);
      setDeferred(null);
      return "unavailable";
    }
  }, [deferred]);

  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const installed = standalone;

  return {
    /** المتصفح جاهز لعرض نافذة التثبيت الأصلية (Chrome/Edge/Android) */
    canNativeInstall: Boolean(deferred),
    installed,
    install,
    isIOS,
    isAndroid,
  };
}
