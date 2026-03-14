export const NOTE_TITLE_TRANSITION_PREFIX = "note-title-";
export const NOTE_DETAIL_TRANSITION_STATE = { hbTransition: "post" } as const;
const PREPARED_POST_TRANSITION_ATTR = "data-hb-transition";

let preparedPostTransitionTimeout: number | null = null;

export function noteTitleTransitionName(noteId: string): string {
  return `${NOTE_TITLE_TRANSITION_PREFIX}${noteId}`;
}

export function noteDetailTransitionState(noteId: string, options?: { title?: string }) {
  const title = options?.title?.trim();
  return {
    ...NOTE_DETAIL_TRANSITION_STATE,
    hbTitleTransitionName: noteTitleTransitionName(noteId),
    ...(title ? { hbTitle: title } : {}),
  } as const;
}

export function preparePostTransition() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute(PREPARED_POST_TRANSITION_ATTR, NOTE_DETAIL_TRANSITION_STATE.hbTransition);

  if (typeof window === "undefined") return;
  if (preparedPostTransitionTimeout !== null) {
    window.clearTimeout(preparedPostTransitionTimeout);
  }

  preparedPostTransitionTimeout = window.setTimeout(() => {
    if (document.documentElement.getAttribute(PREPARED_POST_TRANSITION_ATTR) === NOTE_DETAIL_TRANSITION_STATE.hbTransition) {
      document.documentElement.removeAttribute(PREPARED_POST_TRANSITION_ATTR);
    }
    preparedPostTransitionTimeout = null;
  }, 420);
}

export function preparePostTransitionOnClick(event: {
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}) {
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
  preparePostTransition();
}

export function isPostTransitionState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  return (state as { hbTransition?: string }).hbTransition === "post";
}

export function getPostTitleTransitionName(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as { hbTitleTransitionName?: unknown }).hbTitleTransitionName;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function getPostTransitionTitle(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as { hbTitle?: unknown }).hbTitle;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
