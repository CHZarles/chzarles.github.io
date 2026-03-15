import { NotePage } from "../views/NotePage";

const notePageModulePromise: Promise<{ default: typeof NotePage }> = Promise.resolve({ default: NotePage });
const notePageModuleReady = true;

export function loadNotePageModule() {
  return notePageModulePromise;
}

export function preloadNotePage() {
  // NotePage is eagerly loaded to keep note transitions deterministic.
}

export function isNotePageModuleReady() {
  return notePageModuleReady;
}
