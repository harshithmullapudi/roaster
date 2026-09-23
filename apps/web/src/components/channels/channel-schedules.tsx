"use client";

import type { Schedule, ScheduleRun } from "@roster/api";
import { describeRecurrence } from "@roster/api/client";
import { Button, Input, Switch, cn } from "@roster/ui";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  browserTimezone,
  defaultStartLocal,
  ruleFor,
  SchedulePicker,
  type ScheduleValue,
} from "~/components/tasks/schedule-picker";
import { errorMessage, trpc } from "~/utils/trpc";

export interface ChannelSchedulesProps {
  projectId: string;
  canManage: boolean;
}

const OUTCOME_LABELS: Record<string, string> = {
  fired: "ran",
  skipped_late: "skipped — too late",
  skipped_no_access: "skipped — no access",
  failed: "failed",
};

function describe(schedule: Schedule): string {
  try {
    return describeRecurrence(schedule.rrule);
  } catch {
    return schedule.rrule;
  }
}

function when(at: Date | string | null): string {
  if (!at) return "never";
  return new Date(at).toLocaleString();
}

export function ChannelSchedules({
  projectId,
  canManage,
}: ChannelSchedulesProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<Record<string, ScheduleRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<ScheduleValue>({
    kind: "repeat",
    startLocal: defaultStartLocal(),
    freq: "weekly",
    interval: 1,
    weekdays: [],
  });

  const load = useCallback(async () => {
    try {
      setSchedules(await trpc.schedules.list.query({ projectId }));
    } catch (cause) {
      setError(errorMessage(cause, "Could not load the schedules."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showRuns = useCallback(async (scheduleId: string) => {
    if (runs[scheduleId]) return;
    try {
      const rows = await trpc.schedules.runs.query({ scheduleId, limit: 5 });
      setRuns((current) => ({ ...current, [scheduleId]: rows }));
    } catch {
      setRuns((current) => ({ ...current, [scheduleId]: [] }));
    }
  }, [runs]);

  async function add() {
    const trimmed = title.trim();
    const rrule = draft.kind === "now" ? null : ruleFor(draft);
    if (!trimmed || !rrule) return;

    setError(null);
    try {
      await trpc.schedules.create.mutate({
        projectId,
        title: trimmed,
        rrule,
        timezone: browserTimezone(),
      });
      setTitle("");
      setAdding(false);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "Could not add that schedule."));
    }
  }

  async function toggle(schedule: Schedule, enabled: boolean) {
    setSchedules((current) =>
      current.map((row) => (row.id === schedule.id ? { ...row, enabled } : row)),
    );
    try {
      await trpc.schedules.update.mutate({ scheduleId: schedule.id, enabled });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "Could not change that schedule."));
      await load();
    }
  }

  async function remove(schedule: Schedule) {
    setError(null);
    try {
      await trpc.schedules.remove.mutate({ scheduleId: schedule.id });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "Could not delete that schedule."));
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">
          Schedules{" "}
          <span className="text-muted-foreground">{schedules.length}</span>
        </h2>
        {canManage && (
          <Button
            variant="ghost"
            className="ml-auto h-7 text-xs"
            onClick={() => setAdding((on) => !on)}
          >
            <Plus size={13} className="mr-1" />
            New schedule
          </Button>
        )}
      </div>

      <p className="text-muted-foreground mt-1 text-xs">
        Each run posts a message in this channel. Whether an agent picks it up
        is decided the same way as any other message — watch mode, or a mention.
      </p>

      {error && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {adding && (
        <div className="bg-background-3 mt-3 flex flex-col gap-2 rounded p-3">
          <Input
            autoFocus
            value={title}
            placeholder="What should happen?"
            onChange={(event) => setTitle(event.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <SchedulePicker value={draft} onChange={setDraft} />
            <Button
              className="ml-auto h-8 text-xs"
              disabled={!title.trim() || draft.kind === "now"}
              onClick={() => void add()}
            >
              Add
            </Button>
          </div>
          {draft.kind === "now" && (
            <p className="text-muted-foreground text-xs">
              A schedule needs a time — pick “Once at” or “Repeating”.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <Loader2 className="text-muted-foreground mt-3 size-4 animate-spin" />
      ) : schedules.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Nothing runs on a schedule here yet.
        </p>
      ) : (
        <ul className="bg-background-3 mt-3 flex flex-col divide-y rounded">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex flex-col gap-1 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-sm",
                      !schedule.enabled && "text-muted-foreground line-through",
                    )}
                  >
                    {schedule.title}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {describe(schedule)} · {schedule.timezone} · next{" "}
                    {when(schedule.nextRunAt)}
                  </div>
                </div>

                {canManage && (
                  <>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(on) => void toggle(schedule, on)}
                      aria-label={`Enable ${schedule.title}`}
                    />
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${schedule.title}`}
                      className="h-7 px-2"
                      onClick={() => void remove(schedule)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>

              {schedule.disabledReason && (
                <p className="text-warning text-xs">{schedule.disabledReason}</p>
              )}

              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
                {schedule.createdBy && <span>added by {schedule.createdBy.name}</span>}
                {schedule.runAs && <span>runs as {schedule.runAs.name}</span>}
                <button
                  type="button"
                  className="hover:text-foreground underline"
                  onClick={() => void showRuns(schedule.id)}
                >
                  recent runs
                </button>
              </div>

              {runs[schedule.id] && (
                <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                  {runs[schedule.id]!.length === 0 ? (
                    <li>no runs yet</li>
                  ) : (
                    runs[schedule.id]!.map((run) => (
                      <li key={run.id}>
                        {when(run.slotAt)} — {OUTCOME_LABELS[run.outcome] ?? run.outcome}
                        {run.detail ? ` (${run.detail})` : ""}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
