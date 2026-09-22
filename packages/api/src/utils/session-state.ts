export const THREAD_STATUSES = [
  "starting",
  "running",
  "needs_input",
  "waiting",
  "idle",
  "completed",
  "failed",
  "canceled",
] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export type LifecycleEvent =
  | "Start"
  | "Stop"
  | "Detached"
  | "PermissionRequest"
  | "Failed";

export interface StatusTransition {
  current: string;
  event: LifecycleEvent;
  /**
   * This thread is the child of an open delegation. Completing is what hands
   * its answer back to the thread that asked, so such a session must end
   * rather than rest at idle — otherwise the asking thread waits forever.
   */
  answersDelegation: boolean;
}

const ENDED = new Set(["completed", "failed", "canceled"]);

/** Parked waiting on another agent — its own terminal is quiet by design. */
const DELEGATING = "waiting";

function target(transition: StatusTransition): ThreadStatus {
  switch (transition.event) {
    case "Failed":
      return "failed";
    case "Start":
      return "running";
    case "PermissionRequest":
      return "needs_input";
    case "Stop":
    case "Detached":
      return transition.answersDelegation ? "completed" : "idle";
  }
}

/**
 * The status a lifecycle event moves a session to, or null to leave it as it
 * is. Null covers three cases: the session has already ended, it is parked
 * waiting on another agent, or it is already in the status the event implies.
 */
export function nextStatus(
  transition: StatusTransition,
): ThreadStatus | null {
  if (ENDED.has(transition.current)) return null;
  if (transition.current === DELEGATING) return null;

  const next = target(transition);
  return next === transition.current ? null : next;
}
