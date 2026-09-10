import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppVisualTheme = "classic" | "neon";

const STORAGE_KEY = "idara_visual_theme";

type Ctx = {
  theme: AppVisualTheme;
  setTheme: (t: AppVisualTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStored(): AppVisualTheme {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "neon" || s === "classic") return s;
  } catch {
    /* ignore */
  }
  return "classic";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppVisualTheme>(() =>
    typeof window !== "undefined" ? readStored() : "classic"
  );

  const setTheme = useCallback((t: AppVisualTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "neon" ? "classic" : "neon";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.visualTheme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
