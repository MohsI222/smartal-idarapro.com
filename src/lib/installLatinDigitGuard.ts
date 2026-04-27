/**
 * GLOBAL LATIN DIGIT GUARD — installLatinDigitGuard
 *
 * Import this as the VERY FIRST non-CSS import in main.tsx.
 * It auto-executes on module load (no explicit call needed).
 *
 * Four enforcement layers:
 *  1. Intl.NumberFormat / Intl.DateTimeFormat Proxy — every call, everywhere,
 *     always gets { numberingSystem: "latn" } injected. No third-party lib can escape this.
 *  2. MutationObserver on document.body — sweeps Eastern Arabic-Indic digits
 *     (U+0660–U+0669, U+06F0–U+06F9) out of every text node as soon as they appear.
 *  3. Initial full-body sweep on DOMContentLoaded — catches anything rendered before
 *     the observer connects.
 *  4. Native picker fix — forces lang="en" dir="ltr" on every <input type="date|time|
 *     datetime-local|month|week|number"> so the browser's native picker UI always shows
 *     Latin digits (0–9), regardless of the page lang="ar-*" attribute.
 */
import { toWesternDigits } from "@/lib/unicodeDigits";

// ─── Shared constants ─────────────────────────────────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME",
  "CODE", "PRE", "META", "HEAD",
]);

/** CSS selector for inputs whose browser-native picker must show Latin digits */
const NUMERIC_INPUT_SELECTOR =
  'input[type="date"], input[type="time"], input[type="datetime-local"],' +
  ' input[type="month"], input[type="week"], input[type="number"]';

// ─── Layer 4: Native picker — lang="en" dir="ltr" on date/time inputs ─────────

/**
 * Sets lang="en" and dir="ltr" on every numeric/date/time input so the
 * browser's native picker (calendar, clock wheel) shows Latin digits.
 * The HTML page lang="ar-*" attribute controls text rendering but browsers
 * do NOT honour the u-nu-latn BCP-47 extension for native form controls.
 */
function fixNativePickers(root: Element | Document = document): void {
  try {
    const inputs = root.querySelectorAll(NUMERIC_INPUT_SELECTOR);
    inputs.forEach((inp) => {
      if (inp.getAttribute("lang") !== "en") inp.setAttribute("lang", "en");
      if (inp.getAttribute("dir") !== "ltr") inp.setAttribute("dir", "ltr");
    });
  } catch {
    /* ignore */
  }
}

// ─── Layers 2 + 3: Text-node digit sweeper ───────────────────────────────────

function isSkippable(node: Node): boolean {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node as ChildNode).parentElement;
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest("input, textarea, select, [data-skip-latinize], [contenteditable]")) {
    return true;
  }
  return false;
}

function sweepTextNode(n: Text): void {
  if (isSkippable(n)) return;
  const raw = n.nodeValue;
  if (!raw) return;
  const clean = toWesternDigits(raw);
  if (clean !== raw) n.nodeValue = clean;
}

function sweepTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    sweepTextNode(root as Text);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((root as Element).tagName)) {
    return;
  }
  // Fix native pickers on any element subtree added to the DOM
  if (root.nodeType === Node.ELEMENT_NODE) {
    fixNativePickers(root as Element);
  }
  const children = Array.from(root.childNodes);
  for (const child of children) sweepTree(child);
}

function installBodySweeper(): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;

  /** Synchronous sweep — no RAF so digits are corrected before any paint. */
  const sweepNow = () => {
    if (document.body) {
      sweepTree(document.body);
      fixNativePickers(document);
    }
  };

  const attach = () => {
    sweepNow();

    const obs = new MutationObserver((mutations) => {
      let needPickerFix = false;
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          sweepTextNode(m.target as Text);
        } else {
          m.addedNodes.forEach((n) => {
            sweepTree(n);
            if (n.nodeType === Node.ELEMENT_NODE) needPickerFix = true;
          });
        }
      }
      if (needPickerFix) fixNativePickers(document);
    });
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
}

// ─── Layer 1: Intl Proxy ──────────────────────────────────────────────────────

function patchIntl(): void {
  if (typeof Proxy === "undefined" || typeof Reflect === "undefined") return;

  try {
    const _NF = Intl.NumberFormat;
    // @ts-ignore — intentional global mutation
    Intl.NumberFormat = new Proxy(_NF, {
      construct(
        Target,
        args: [string | string[] | undefined, Intl.NumberFormatOptions | undefined]
      ) {
        const [locale, opts] = args;
        return Reflect.construct(Target, [locale, { ...opts, numberingSystem: "latn" }], Target);
      },
      apply(
        Target,
        thisArg: unknown,
        args: [string | string[] | undefined, Intl.NumberFormatOptions | undefined]
      ) {
        const [locale, opts] = args;
        return Reflect.apply(
          Target as (...a: unknown[]) => unknown,
          thisArg,
          [locale, { ...opts, numberingSystem: "latn" }]
        );
      },
    });
  } catch {
    /* some environments prevent Intl mutation — fail silently */
  }

  try {
    const _DTF = Intl.DateTimeFormat;
    // @ts-ignore — intentional global mutation
    Intl.DateTimeFormat = new Proxy(_DTF, {
      construct(
        Target,
        args: [string | string[] | undefined, Intl.DateTimeFormatOptions | undefined]
      ) {
        const [locale, opts] = args;
        return Reflect.construct(Target, [locale, { ...opts, numberingSystem: "latn" }], Target);
      },
      apply(
        Target,
        thisArg: unknown,
        args: [string | string[] | undefined, Intl.DateTimeFormatOptions | undefined]
      ) {
        const [locale, opts] = args;
        return Reflect.apply(
          Target as (...a: unknown[]) => unknown,
          thisArg,
          [locale, { ...opts, numberingSystem: "latn" }]
        );
      },
    });
  } catch {
    /* ignore */
  }
}

// ─── Self-install ─────────────────────────────────────────────────────────────

let _installed = false;

export function installLatinDigitGuard(): void {
  if (_installed) return;
  _installed = true;
  patchIntl();
  installBodySweeper();
}

// Auto-execute on import — no explicit call required
installLatinDigitGuard();
