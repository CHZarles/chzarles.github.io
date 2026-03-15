export type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type StyleSnapshot = {
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
};

export const MANUAL_NOTE_TITLE_TRANSITION_MS = 520;

export type ManualNoteTitleSnapshot = {
  noteId: string;
  title: string;
  rect: RectSnapshot;
  style: StyleSnapshot;
};

let pendingSnapshot: ManualNoteTitleSnapshot | null = null;

export function captureManualNoteTitleTransition(noteId: string, title: string, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  pendingSnapshot = {
    noteId,
    title,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    style: {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    },
  };
}

export function consumeManualNoteTitleTransition(noteId: string): ManualNoteTitleSnapshot | null {
  if (!pendingSnapshot || pendingSnapshot.noteId !== noteId) return null;
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  return snapshot;
}

export function clearManualNoteTitleTransition() {
  pendingSnapshot = null;
}
