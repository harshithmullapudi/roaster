export type ToastTone = "loading" | "success" | "error";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
}

export interface ToastHandle {
  id: string;
  loading: (title: string, description?: string) => ToastHandle;
  success: (title: string, description?: string) => ToastHandle;
  error: (title: string, description?: string) => ToastHandle;
  dismiss: () => void;
}

export const MAX_TOASTS = 4;

const DURATIONS: Record<ToastTone, number> = {
  loading: Number.POSITIVE_INFINITY,
  success: 4000,
  error: 8000,
};

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function publish(next: Toast[]): void {
  toasts = next;
  for (const listener of listeners) listener();
}

function put(note: Toast): void {
  const at = toasts.findIndex((entry) => entry.id === note.id);
  if (at === -1) {
    publish([...toasts, note].slice(-MAX_TOASTS));
    return;
  }
  publish(toasts.map((entry) => (entry.id === note.id ? note : entry)));
}

function drop(id: string): void {
  const next = toasts.filter((entry) => entry.id !== id);
  if (next.length !== toasts.length) publish(next);
}

function handle(id: string): ToastHandle {
  function show(tone: ToastTone) {
    return (title: string, description?: string) => {
      put({ id, tone, title, description, duration: DURATIONS[tone] });
      return handle(id);
    };
  }

  return {
    id,
    loading: show("loading"),
    success: show("success"),
    error: show("error"),
    dismiss: () => drop(id),
  };
}

function raise(tone: ToastTone) {
  return (title: string, description?: string): ToastHandle => {
    counter += 1;
    return handle(`toast-${counter}`)[tone](title, description);
  };
}

export const toast = {
  loading: raise("loading"),
  success: raise("success"),
  error: raise("error"),
};

export function readToasts(): Toast[] {
  return toasts;
}

export function dismissToast(id: string): void {
  drop(id);
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetToasts(): void {
  toasts = [];
  counter = 0;
  listeners.clear();
}
