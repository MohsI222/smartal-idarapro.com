import { useEffect } from "react";
import { toWesternDigits } from "@/lib/unicodeDigits";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME",
  "CODE", "PRE", "META",
]);

function isSkippableContext(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest("input, textarea, select, [data-skip-latinize], [contenteditable]")) {
    return true;
  }
  return false;
}

function sanitizeTextNode(n: Text): void {
  const p = n.parentElement;
  if (isSkippableContext(p)) return;
  const t = n.nodeValue;
  if (t == null || t.length === 0) return;
  const next = toWesternDigits(t);
  if (next !== t) n.nodeValue = next;
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    sanitizeTextNode(root as Text);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((root as Element).tagName)) {
    return;
  }
  for (const c of root.childNodes) {
    walk(c);
  }
}

/**
 * Attaches to document.body (not just #root) so that portals, dialogs,
 * Radix overlays, and Sonner toasts are all covered.
 *
 * The global installLatinDigitGuard in main.tsx runs a parallel sweeper,
 * so this hook is a React-lifecycle-aware complement.
 */
export function useGlobalDomDigitLatinize(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    // Prefer document.body so portals and dialogs are covered;
    // fall back to #root for SSR safety.
    const root = document.body ?? document.getElementById("root");
    if (!root) return;

    // Synchronous initial sweep — no RAF so digits are already correct on first paint
    walk(root);

    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          sanitizeTextNode(m.target as Text);
        } else {
          m.addedNodes.forEach((n) => walk(n));
        }
      }
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [enabled]);
}
