"use client";

import {
  notificationBody,
  notificationTitle,
  type PublishedNotification,
} from "./notification-cache";

interface TauriNotificationApi {
  isPermissionGranted: () => Promise<boolean>;
  requestPermission: () => Promise<string>;
  sendNotification: (options: { title: string; body: string }) => void;
}

let api: Promise<TauriNotificationApi | null> | null = null;
let allowed: boolean | null = null;

function insideDesktopApp(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object)
  );
}

function loadApi(): Promise<TauriNotificationApi | null> {
  if (!api) {
    api = import("@tauri-apps/plugin-notification")
      .then((module) => module as unknown as TauriNotificationApi)
      .catch(() => null);
  }
  return api;
}

export async function prepareDesktopNotifications(): Promise<boolean> {
  if (!insideDesktopApp()) return false;
  if (allowed !== null) return allowed;

  const notifications = await loadApi();
  if (!notifications) {
    allowed = false;
    return allowed;
  }

  try {
    allowed = await notifications.isPermissionGranted();
    if (!allowed) {
      allowed = (await notifications.requestPermission()) === "granted";
    }
  } catch {
    allowed = false;
  }

  return allowed;
}

export async function showDesktopNotification(
  item: PublishedNotification,
): Promise<void> {
  if (!(await prepareDesktopNotifications())) return;

  const notifications = await loadApi();
  if (!notifications) return;

  try {
    notifications.sendNotification({
      title: notificationTitle(item),
      body: notificationBody(item),
    });
  } catch {
    allowed = false;
  }
}
