import { Moon, Sun } from "lucide-react";
import { useAppState } from "../state/AppState";

export function ThemeToggle() {
  const { theme, setTheme } = useAppState();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
      aria-label="Toggle theme"
    >
      {isLight ? <Moon className="h-4 w-4 opacity-90" /> : <Sun className="h-4 w-4 opacity-90" />}
    </button>
  );
}
