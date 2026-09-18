"use client";

import { Button, Input } from "@roster/ui";
import { type FormEvent, type ReactNode, useState } from "react";

import { errorMessage } from "~/utils/trpc";

import { SettingRow } from "./settings-page";

export interface InlineTextSettingProps {
  label: string;
  description?: string;
  placeholder?: string;
  initialValue: string;
  hint?: (value: string) => ReactNode;
  errorFallback: string;
  onSave: (value: string) => Promise<void>;
}

export function InlineTextSetting({
  label,
  description,
  placeholder,
  initialValue,
  hint,
  errorFallback,
  onSave,
}: InlineTextSettingProps) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const dirty = trimmed !== saved && trimmed.length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || pending) return;

    setPending(true);
    setError(null);

    try {
      await onSave(trimmed);
      setSaved(trimmed);
      setValue(trimmed);
    } catch (cause) {
      setError(errorMessage(cause, errorFallback));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingRow label={label} description={description}>
      <form onSubmit={submit} className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Input
            aria-label={label}
            autoComplete="off"
            className="w-48 sm:w-56"
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            disabled={!dirty || pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>

        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : (
          hint?.(trimmed)
        )}
      </form>
    </SettingRow>
  );
}
