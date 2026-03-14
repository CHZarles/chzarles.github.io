import { Moon, Sun } from "lucide-react";
import { useAppState } from "../state/AppState";

export function ThemeToggle() {
  const { theme, setTheme } = useAppState();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="inline-flex size-8 items-center justify-center text-[hsl(var(--fg))] transition hover:text-[hsl(var(--accent))]"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {isLight ? <Moon className="h-4 w-4 opacity-90" /> : <Sun className="h-4 w-4 opacity-90" />}
    </button>
  );
}
